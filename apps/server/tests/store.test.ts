import{beforeEach,describe,expect,it}from"vitest";
import{ackHandoff,authenticateDevice,authenticateGrant,completePairing,createHandoff,latestHandoff,resetStore,startPairing}from"../src/store.js";
describe("페어링과 handoff",()=>{
 beforeEach(resetStore);
 it("서버 생성 기기·토큰·일회용 코드·opaque grant",()=>{const pairing=startPairing();expect(authenticateDevice(pairing.deviceToken)).toBe(pairing.deviceId);const completed=completePairing(pairing.code);expect(completed?.connectionGrant).toBeTruthy();expect(authenticateGrant(completed!.connectionGrant)).toBe(pairing.deviceId);expect(completePairing(pairing.code)).toBeNull()});
 it("idempotency와 ACK",()=>{const first=createHandoff("d",{items:[1]},"same-key");const retry=createHandoff("d",{items:[1]},"same-key");expect(first.id).toBe(retry.id);expect(latestHandoff("d")?.id).toBe(first.id);expect(ackHandoff("d",first.id)).toBe(true);expect(latestHandoff("d")).toBeNull()});
 it("페어링 코드 대입을 분당 30회로 제한",()=>{const pairing=startPairing();for(let attempt=0;attempt<30;attempt+=1)expect(completePairing("000000")).toBeNull();expect(completePairing(pairing.code)).toBeNull()});
});
