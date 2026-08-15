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
  const sorted = [...results];
  const rankBy = (key: keyof Pick<EngineResult, "iaRaw" | "confidence" | "iaEffective" | "iaFinal">) =>
    [...sorted]
      .sort((a, b) => (b[key] as number) - (a[key] as number))
      .map((r) => r.symbol);

  const fundOrder = rankBy("iaRaw");
  const confOrder = rankBy("confidence");
  const effOrder = rankBy("iaEffective");
  const mktOrder = rankBy("iaFinal");

  const rankOf = (order: string[], sym: string) => order.indexOf(sym) + 1;

  return results.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    result: r,
    rankFund: rankOf(fundOrder, r.symbol),
    rankConf: rankOf(confOrder, r.symbol),
    rankEff: rankOf(effOrder, r.symbol),
    rankMkt: rankOf(mktOrder, r.symbol),
  }));
}
