import { shoppingRequestLineSchema,type ShoppingRequestLine } from "./schemas.js";
const capacity:Record<string,ShoppingRequestLine["unitSizeUnit"]>={ml:"mL",l:"L",g:"g",kg:"kg"};
const strength:Record<string,ShoppingRequestLine["strengthUnit"]>={mg:"mg",mcg:"mcg","μg":"mcg",iu:"IU","%":"%"};
const packageUnits=new Set(["정","캡슐","포","매","개입","스틱","패치"]);
const purchaseUnits=new Set(["개","병","통","세트","박스","입"]);
type Token={value:number;unit:string;start:number};
const tokenize=(text:string):Token[]=>[...text.matchAll(/(\d+(?:\.\d+)?)\s*(mL|ml|L|l|kg|g|mg|mcg|μg|IU|iu|%|정|캡슐|포|매|개입|스틱|패치|개|병|통|세트|박스|입)(?=\s|[x×+]|$)/gu)].map(m=>({value:Number(m[1]),unit:m[2],start:m.index??0}));

export function parseShoppingLine(rawText:string,index=0):ShoppingRequestLine{
  const normalizedText=rawText.trim().replace(/\s+/g," ");
  const tokens=tokenize(normalizedText);
  let unitSizeValue:number|null=null,unitSizeUnit:ShoppingRequestLine["unitSizeUnit"]=null;
  let strengthValue:number|null=null,strengthUnit:ShoppingRequestLine["strengthUnit"]=null;
  let packageContentCount:number|null=null,packageContentUnit:ShoppingRequestLine["packageContentUnit"]=null,requestedPhysicalUnits=1;
  for(const token of tokens){
    const lower=token.unit.toLowerCase();
    if(capacity[lower]){unitSizeValue??=token.value;unitSizeUnit??=capacity[lower];}
    else if(strength[lower]){strengthValue??=token.value;strengthUnit??=strength[lower];}
    else if(packageUnits.has(token.unit)){packageContentCount??=token.value;packageContentUnit??=token.unit as ShoppingRequestLine["packageContentUnit"];}
    else if(purchaseUnits.has(token.unit)){requestedPhysicalUnits=token.value;}
  }
  const multiplier=normalizedText.match(/[x×]\s*(\d+)\s*$/iu); if(multiplier)requestedPhysicalUnits=Number(multiplier[1]);
  const components=[...normalizedText.matchAll(/(?:^|\s|\+)\s*(본품|리필)\s*(\d+)\s*(개|병|통|세트|박스)(?=\s|\+|$)/gu)];
  const variantTokens=components.map(match=>`${match[1]} ${match[2]}${match[3]}`);if(components.length)requestedPhysicalUnits=components.reduce((sum,match)=>sum+Number(match[2]),0);
  const componentStart=components[0]?.index??normalizedText.length;const nameEnd=Math.min(tokens.length?Math.min(...tokens.map(t=>t.start)):normalizedText.length,componentStart);
  const productName=normalizedText.slice(0,nameEnd).trim();
  const parseWarnings=productName?[]:["제품명을 확인해 주세요."];
  return shoppingRequestLineSchema.parse({id:`line-${index+1}`,rawText,normalizedText,brand:productName.split(" ")[0]||null,productName:productName||normalizedText,variantTokens,unitSizeValue,unitSizeUnit,strengthValue,strengthUnit,packageContentCount,packageContentUnit,requestedPhysicalUnits,requestedPurchaseUnits:1,parserConfidence:parseWarnings.length?0.7:0.98,parseWarnings});
}
export const parseShoppingList=(input:string)=>input.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(parseShoppingLine);
