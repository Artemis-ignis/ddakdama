import{describe,expect,it}from"vitest";
import{planCartResume}from"../src/cart-journal";
describe("서비스 워커 장바구니 재개",()=>{
 it("첫 실행은 요청 수량 전체를 추가한다",()=>expect(planCartResume(1,2)).toEqual({beforeQuantity:1,targetQuantity:3,remainingQuantity:2,alreadySatisfied:false}));
 it("한 개 추가 후 중단되면 남은 한 개만 추가한다",()=>expect(planCartResume(2,2,{jobId:"a",beforeQuantity:1,targetQuantity:3,updatedAt:1}).remainingQuantity).toBe(1));
 it("목표 수량이 이미 있으면 중복 추가하지 않는다",()=>expect(planCartResume(3,2,{jobId:"a",beforeQuantity:1,targetQuantity:3,updatedAt:1}).alreadySatisfied).toBe(true));
});
