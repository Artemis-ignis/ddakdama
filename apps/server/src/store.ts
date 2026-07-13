import{randomBytes,randomUUID,createHash}from"node:crypto";
type Pairing={code:string;deviceId:string;expiresAt:number;used:boolean};
type Handoff={id:string;deviceId:string;payload:unknown;createdAt:number;expiresAt:number;ackedAt:number|null;idempotencyKey:string};
const pairings=new Map<string,Pairing>();const tokens=new Map<string,string>();const handoffs=new Map<string,Handoff>();
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
export function startPairing(deviceId:string,ttlMs=600_000){if(!deviceId)throw new Error("DEVICE_ID_REQUIRED");const code=String(Math.floor(100000+Math.random()*900000));const deviceToken=randomBytes(32).toString("base64url");const expiresAt=Date.now()+ttlMs;pairings.set(code,{code,deviceId,expiresAt,used:false});tokens.set(hash(deviceToken),deviceId);return{code,deviceToken,expiresAt}}
export function completePairing(code:string){const p=pairings.get(code);if(!p||p.used||p.expiresAt<Date.now())return null;p.used=true;return{deviceId:p.deviceId}}
export const authenticateDevice=(token:string)=>tokens.get(hash(token))??null;
export function createHandoff(deviceId:string,payload:unknown,idempotencyKey:string,ttlMs=900_000){const existing=[...handoffs.values()].find(h=>h.deviceId===deviceId&&h.idempotencyKey===idempotencyKey&&h.expiresAt>Date.now());if(existing)return existing;const item={id:randomUUID(),deviceId,payload,createdAt:Date.now(),expiresAt:Date.now()+ttlMs,ackedAt:null,idempotencyKey};handoffs.set(item.id,item);return item}
export const latestHandoff=(deviceId:string)=>[...handoffs.values()].filter(h=>h.deviceId===deviceId&&h.expiresAt>Date.now()&&!h.ackedAt).sort((a,b)=>b.createdAt-a.createdAt)[0]??null;
export function ackHandoff(deviceId:string,id:string){const item=handoffs.get(id);if(!item||item.deviceId!==deviceId||item.expiresAt<Date.now())return false;item.ackedAt=Date.now();return true}
export const handoffStatus=(id:string)=>{const h=handoffs.get(id);return h?{id:h.id,received:Boolean(h.ackedAt),expired:h.expiresAt<Date.now()}:null};
export function resetStore(){pairings.clear();tokens.clear();handoffs.clear()}
