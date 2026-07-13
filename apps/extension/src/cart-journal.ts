export type CartCheckpoint={jobId:string;beforeQuantity:number;targetQuantity:number;updatedAt:number};
export function planCartResume(currentQuantity:number,requestedIncrease:number,checkpoint?:CartCheckpoint){
 const beforeQuantity=checkpoint?.beforeQuantity??currentQuantity;
 const targetQuantity=checkpoint?.targetQuantity??currentQuantity+requestedIncrease;
 const remainingQuantity=Math.max(0,targetQuantity-currentQuantity);
 return{beforeQuantity,targetQuantity,remainingQuantity,alreadySatisfied:remainingQuantity===0};
}
