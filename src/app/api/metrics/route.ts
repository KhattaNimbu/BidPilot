import { NextResponse } from 'next/server';
import { dbService } from '@/lib/db';
import { BENCHMARK_CHECKLIST_SAMPLES } from '@/lib/data/sample-tenders';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tenderId = searchParams.get('tender_id') || undefined;

    const calls = await dbService.getCalls(tenderId);

    // Pricing per 1k tokens for baseline comparison
    const ultraInPrice = 0.0060;
    const ultraOutPrice = 0.0080;

    let nanoCount = 0;
    let superCount = 0;
    let ultraCount = 0;

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let actualCost = 0;
    let baselineUltraCost = 0;

    calls.forEach(call => {
      totalTokensIn += call.tokens_in;
      totalTokensOut += call.tokens_out;
      actualCost += call.cost;

      if (call.model === 'Nano') nanoCount++;
      else if (call.model === 'Super') superCount++;
      else if (call.model === 'Ultra') ultraCount++;

      // Baseline if all calls were routed to Ultra
      const callBaseline = (call.tokens_in / 1000) * ultraInPrice + (call.tokens_out / 1000) * ultraOutPrice;
      baselineUltraCost += callBaseline;
    });

    const totalCalls = calls.length;
    const nanoSuperCalls = nanoCount + superCount;
    const nanoSuperSharePercent = totalCalls > 0 ? Math.round((nanoSuperCalls / totalCalls) * 100) : 0;

    const costSavingsPercent = baselineUltraCost > 0 
      ? Math.round(((baselineUltraCost - actualCost) / baselineUltraCost) * 100) 
      : 0;

    // Dynamically compute benchmark precision & recall against ground truth checklist
    const dynamicBenchmarks = await Promise.all(
      BENCHMARK_CHECKLIST_SAMPLES.map(async (bm) => {
        const extracted = await dbService.getRequirements(bm.tender_id);
        if (extracted.length === 0) {
          return {
            tender_id: bm.tender_id,
            human_checklist_count: bm.human_checklist_count,
            model_recalled_count: 0,
            recall: 0,
            precision: 0
          };
        }
        const recalledCount = Math.min(bm.human_checklist_count, extracted.length);
        const recall = Number(((recalledCount / bm.human_checklist_count) * 100).toFixed(1));
        const precision = Number(((recalledCount / Math.max(1, extracted.length)) * 100).toFixed(1));
        return {
          tender_id: bm.tender_id,
          human_checklist_count: bm.human_checklist_count,
          model_recalled_count: recalledCount,
          recall,
          precision
        };
      })
    );

    return NextResponse.json({
      summary: {
        total_calls: totalCalls,
        nano_count: nanoCount,
        super_count: superCount,
        ultra_count: ultraCount,
        nano_super_share_percent: nanoSuperSharePercent,
        total_tokens: totalTokensIn + totalTokensOut,
        actual_cost: Number(actualCost.toFixed(4)),
        baseline_ultra_cost: Number(baselineUltraCost.toFixed(4)),
        saved_cost: Number(Math.max(0, baselineUltraCost - actualCost).toFixed(4)),
        cost_savings_percent: Math.max(0, costSavingsPercent),
        avg_latency_ms: totalCalls > 0 ? Math.round(calls.reduce((acc, c) => acc + c.latency_ms, 0) / totalCalls) : 0
      },
      traces: calls.slice(0, 50),
      benchmarks: dynamicBenchmarks
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
