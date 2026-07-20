import{createServer,type IncomingMessage,type ServerResponse}from"node:http";
import{createHash}from"node:crypto";
import{readFileSync}from"node:fs";
import{StreamableHTTPServerTransport}from"@modelcontextprotocol/sdk/server/streamableHttp.js";
import{z}from"zod";
import{createMcpServer}from"./mcp-node.js";
import{ackHandoff,authenticateDevice,latestHandoff,pairingStatus,revokeDeviceToken,startPairing}from"./store.js";
import{createDeepLinks,normalizeDeepLinkPayload,normalizeSearchPayload,partnersConfigured,searchProducts}from"./partners.js";

const port=Number(process.env.PORT??8787);const limits=new Map<string,{count:number;resetAt:number}>();
const buildId=createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex").slice(0,12);
const allowedOrigin=(origin:string)=>/^chrome-extension:\/\/[a-p]{32}$/.test(origin)||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
const apiCors=(req:IncomingMessage)=>{const origin=String(req.headers.origin??"");return{"access-control-allow-origin":allowedOrigin(origin)?origin:"null","access-control-allow-methods":"GET,POST,DELETE,OPTIONS","access-control-allow-headers":"authorization,content-type","access-control-max-age":"600","vary":"Origin"}};
const json=(req:IncomingMessage,res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...apiCors(req)});res.end(JSON.stringify(data))};
async function read(req:IncomingMessage){const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const value=Buffer.from(chunk);size+=value.length;if(size>65_536)throw new Error("BODY_TOO_LARGE");chunks.push(value)}return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}")}
const bearer=(req:IncomingMessage)=>String(req.headers.authorization??"").replace(/^Bearer\s+/i,"");
function rateLimited(req:IncomingMessage,route:string,max=30){const key=`${req.socket.remoteAddress??"unknown"}:${route}`;const now=Date.now();const current=limits.get(key);if(!current||current.resetAt<now){limits.set(key,{count:1,resetAt:now+60_000});return false}current.count+=1;return current.count>max}
const searchInput=z.object({keyword:z.string().trim().min(1).max(200),limit:z.number().int().min(1).max(20).default(10)});
const deepLinkInput=z.object({urls:z.array(z.string().url().refine(value=>new URL(value).hostname.endsWith("coupang.com"))).min(1).max(20)});

createServer(async(req,res)=>{try{const url=new URL(req.url??"/",`http://${req.headers.host??"localhost"}`);
 if(req.method==="OPTIONS"&&url.pathname.startsWith("/api/")){res.writeHead(204,apiCors(req));return res.end()}
 if(req.method==="GET"&&url.pathname==="/health")return json(req,res,200,{ok:true,name:"ddakdama",version:"1.0.2",buildId,status:"available"});
 if(req.method==="POST"&&url.pathname==="/api/pairing/start"){if(rateLimited(req,"pairing",10))return json(req,res,429,{error:"rate_limited"});await read(req);return json(req,res,201,startPairing())}
 if(req.method==="GET"&&url.pathname==="/api/pairing/status"){const deviceId=authenticateDevice(bearer(req));if(!deviceId)return json(req,res,401,{error:"unauthorized"});return json(req,res,200,pairingStatus(deviceId))}
 if(req.method==="GET"&&url.pathname==="/api/handoffs/latest"){const deviceId=authenticateDevice(bearer(req));if(!deviceId)return json(req,res,401,{error:"unauthorized"});return json(req,res,200,{handoff:latestHandoff(deviceId)})}
 const ack=url.pathname.match(/^\/api\/handoffs\/([^/]+)\/ack$/);if(req.method==="POST"&&ack){const deviceId=authenticateDevice(bearer(req));if(!deviceId)return json(req,res,401,{error:"unauthorized"});const acknowledged=ackHandoff(deviceId,ack[1]);return json(req,res,acknowledged?200:404,{ok:acknowledged})}
 if(req.method==="POST"&&url.pathname==="/api/device/revoke"){const token=bearer(req);if(!authenticateDevice(token))return json(req,res,401,{error:"unauthorized"});revokeDeviceToken(token);return json(req,res,200,{ok:true})}
 if(req.method==="GET"&&url.pathname==="/api/affiliate/status")return json(req,res,200,{configured:partnersConfigured(),mode:"private",disclosure:"쿠팡 파트너스 활동을 통해 일정액의 수수료를 받을 수 있습니다."});
 if(req.method==="POST"&&url.pathname.startsWith("/api/affiliate/")){const deviceId=authenticateDevice(bearer(req));if(!deviceId)return json(req,res,401,{error:"unauthorized"});if(rateLimited(req,"affiliate",30))return json(req,res,429,{error:"rate_limited"});if(!partnersConfigured())return json(req,res,503,{error:"PARTNERS_NOT_CONFIGURED",fallback:url.pathname.endsWith("search")?"BROWSER_SEARCH":"DIRECT_COUPANG_URL"});const body=await read(req);if(url.pathname.endsWith("/search")){const input=searchInput.parse(body);return json(req,res,200,{results:normalizeSearchPayload(await searchProducts(input.keyword,input.limit))})}if(url.pathname.endsWith("/deeplink")){const input=deepLinkInput.parse(body);return json(req,res,200,{links:normalizeDeepLinkPayload(await createDeepLinks(input.urls))})}}
 if(url.pathname==="/mcp"&&["GET","POST","DELETE"].includes(req.method??"")){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Expose-Headers","Mcp-Session-Id");const server=createMcpServer({pairingClientKey:req.socket.remoteAddress??"unknown"});const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});res.on("close",()=>{void transport.close();void server.close()});await server.connect(transport);return transport.handleRequest(req,res)}
 res.writeHead(404).end("Not Found");
 }catch(error){console.error("[ddakdama]",error instanceof Error?error.message:"unknown");if(!res.headersSent)json(req,res,error instanceof z.ZodError?400:error instanceof Error&&error.message==="BODY_TOO_LARGE"?413:500,{error:error instanceof z.ZodError?"invalid_input":error instanceof Error&&error.message==="BODY_TOO_LARGE"?"body_too_large":"internal_error"})}}).listen(port,()=>console.log(`딱담아: http://localhost:${port}/mcp`));
