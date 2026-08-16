/**
 * Ranking utility — produces the four-tier ranking.
 * Fundamental / Confidence / Effective / Market.
 */
import type { EngineResult } from "./index";

export interface RankedRow {
  symbol: string;
  name: string;
  result: EngineResult;
  rankFund: number;
  rankConf: number;
  rankEff: number;
  rankMkt: number;
}

export function rankResults(results: EngineResult[]): RankedRow[] {
  // Competition ranking: tied assets share the same rank (1 + count of
  // strictly-better). The old indexOf-based approach returned the FIRST
  // match for tied values, giving tied assets different ranks — a bug.
  const rankByKey = (key: keyof Pick<EngineResult, "iaRaw" | "confidence" | "iaEffective" | "iaFinal">) => {
    const map = new Map<string, number>();
    for (const r of results) {
      const myVal = r[key] as number;
      // rank = 1 + number of assets strictly better than me
      let strictlyBetter = 0;
      for (const other of results) {
        if ((other[key] as number) > myVal) strictlyBetter++;
      }
      map.set(r.symbol, strictlyBetter + 1);
    }
    return map;
  };

  const fundRank = rankByKey("iaRaw");
  const confRank = rankByKey("confidence");
  const effRank = rankByKey("iaEffective");
  const mktRank = rankByKey("iaFinal");

  return results.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    result: r,
    rankFund: fundRank.get(r.symbol)!,
    rankConf: confRank.get(r.symbol)!,
    rankEff: effRank.get(r.symbol)!,
    rankMkt: mktRank.get(r.symbol)!,
  }));
}
