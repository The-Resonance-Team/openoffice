export function PdfBody() {
  const rows: [string, string, string, string][] = [
    ['$10–25M ARR', '21%', '34%', '58%'],
    ['$25–50M ARR', '18%', '29%', '47%'],
    ['$50–100M ARR', '14%', '22%', '36%'],
  ];
  return (
    <div className="flex flex-col items-center gap-5 py-6 font-serif text-[#1b1b1b]">
      <div className="min-h-[780px] w-[580px] max-w-[92%] rounded-md bg-white p-[50px_56px] shadow-xl">
        <div className="mb-[26px] flex items-center gap-[10px] border-b-2 border-[#1b1b1b] pb-3">
          <div className="text-[13px] font-bold">HORIZON RESEARCH</div>
          <div className="flex-1" />
          <div className="text-[11px] text-[#888]">Market Intelligence Report</div>
        </div>
        <h1 className="mb-[6px] font-serif text-[26px] font-bold leading-[1.2]">
          SaaS Market Benchmark 2026
        </h1>
        <div className="mb-[26px] text-[15px] text-[#555]">
          Third-Quarter Update · Growth &amp; Efficiency Percentiles
        </div>
        <p className="mb-3 text-justify text-[13.5px] leading-[1.75]">
          This benchmark aggregates operating metrics from 480 private B2B software companies with
          $10M–$100M in annual recurring revenue. Figures reflect data reported through 30 September
          2026 and are presented as percentile bands to preserve confidentiality.
        </p>
        <h2 className="my-[10px] mt-[22px] font-serif text-[15px] font-bold">
          Growth by percentile
        </h2>
        <table className="mb-[22px] w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="border border-[#cfcfcf] bg-[#f2f2f2] p-[7px_10px] text-left">
                YoY growth
              </th>
              <th className="border border-[#cfcfcf] bg-[#f2f2f2] p-[7px_10px] text-right">25th</th>
              <th className="border border-[#cfcfcf] bg-[#f2f2f2] p-[7px_10px] text-right">
                Median
              </th>
              <th className="border border-[#cfcfcf] bg-[#f2f2f2] p-[7px_10px] text-right">75th</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>
                {r.map((v, i) => (
                  <td
                    key={i}
                    className={`border border-[#cfcfcf] p-[6px_10px] ${i > 0 ? 'text-right' : ''}`}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-justify text-[13.5px] leading-[1.75]">
          Companies sustaining net revenue retention above 115% clustered in the top growth quartile
          regardless of size band, reinforcing expansion revenue as the dominant efficient-growth
          lever this cycle.
        </p>
      </div>
    </div>
  );
}
