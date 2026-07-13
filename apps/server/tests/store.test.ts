import{beforeEach,describe,expect,it}from"vitest";
import{ackHandoff,authenticateDevice,completePairing,createHandoff,latestHandoff,resetStore,startPairing}from"../src/store.js";
describe("페어링과 handoff",()=>{
 beforeEach(resetStore);
 it("확장 프로그램 토큰과 일회용 페어링 코드",()=>{const pairing=startPairing("device-1");expect(authenticateDevice(pairing.deviceToken)).toBe("device-1");expect(completePairing(pairing.code)?.deviceId).toBe("device-1");expect(completePairing(pairing.code)).toBeNull()});
 it("idempotency와 ACK",()=>{const first=createHandoff("d",{items:[1]},"same-key");const retry=createHandoff("d",{items:[1]},"same-key");expect(first.id).toBe(retry.id);expect(latestHandoff("d")?.id).toBe(first.id);expect(ackHandoff("d",first.id)).toBe(true);expect(latestHandoff("d")).toBeNull()});
});
