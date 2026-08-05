export function DocxBody() {
  return (
    <div className="flex flex-col items-center gap-[22px] py-6 font-serif text-[#1b1b1b]">
      <div className="min-h-[800px] w-[600px] max-w-[92%] rounded-md bg-white p-[52px_60px] shadow-xl">
        <div className="mb-[30px] border-b border-[#d9d9d9] pb-2 text-right text-[10.5px] text-[#8a8a8a]">
          Q3 FY2026 Board Report · v0.9 (draft) · Confidential
        </div>
        <div className="text-center">
          <div className="text-[15px] font-bold tracking-[.06em]">
            MERIDIAN LABS, INC.
          </div>
          <div className="mt-[2px] text-[13px] text-[#555]">
            Board of Directors
          </div>
          <div className="mx-auto mt-4 h-[2px] w-20 bg-[#1b1b1b]" />
        </div>
        <h1 className="mb-[6px] mt-[42px] text-center font-serif text-[29px] font-bold leading-[1.15]">
          QUARTERLY BOARD REPORT
        </h1>
        <div className="mb-8 text-center text-[18px] text-[#333]">
          Third Quarter — Fiscal Year 2026
        </div>
        <table className="mb-8 w-full border-collapse text-[12.5px]">
          <tbody>
            {[
              ["Document version", "0.9 — draft for review"],
              ["Issue date", "14 October 2026"],
              ["Prepared by", "Finance & Strategy"],
              ["Classification", "Confidential — internal"],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="w-[42%] border border-[#cfcfcf] bg-[#f4f4f4] p-[7px_11px] font-semibold">
                  {k}
                </td>
                <td className="border border-[#cfcfcf] p-[7px_11px]">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2 className="mb-2 font-serif text-[17px] font-bold">
          1. Executive summary
        </h2>
        <p className="mb-3 text-justify text-[13.5px] leading-[1.75]">
          The third quarter closed materially ahead of plan. Total revenue
          reached $24.8M, an 18% increase over Q2 and 29% year over year, driven
          principally by enterprise expansion and a stronger-than-expected
          services attach rate.
        </p>
        <p className="text-justify text-[13.5px] leading-[1.75]">
          Gross margin improved to 75.1% as infrastructure efficiencies flowed
          through, and the business reached EBITDA breakeven a full quarter
          earlier than the board&apos;s June forecast. Two one-off items are
          broken out separately so that normalized growth can be assessed on its
          own.
        </p>
      </div>
      <div className="min-h-[800px] w-[600px] max-w-[92%] rounded-md bg-white p-[52px_60px] shadow-xl">
        <h2 className="mb-3 font-serif text-[17px] font-bold">
          2. Financial highlights
        </h2>
        <table className="mb-5 w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="border border-[#cfcfcf] bg-[#eef1f6] p-[7px_10px] text-left">
                Metric
              </th>
              <th className="border border-[#cfcfcf] bg-[#eef1f6] p-[7px_10px] text-right">
                Q2
              </th>
              <th className="border border-[#cfcfcf] bg-[#eef1f6] p-[7px_10px] text-right">
                Q3
              </th>
              <th className="border border-[#cfcfcf] bg-[#eef1f6] p-[7px_10px] text-right">
                QoQ
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Total revenue", "21,010", "24,830", "+18.2%", false],
              ["Gross profit", "15,540", "18,650", "+20.0%", false],
              ["EBITDA", "1,760", "3,550", "+101.7%", true],
            ].map(([label, q2, q3, qoq, bold]) => (
              <tr key={label as string}>
                <td
                  className={`border border-[#cfcfcf] p-[6px_10px] ${bold ? "font-bold" : ""}`}
                >
                  {label}
                </td>
                <td
                  className={`border border-[#cfcfcf] p-[6px_10px] text-right ${bold ? "font-bold" : ""}`}
                >
                  {q2}
                </td>
                <td
                  className={`border border-[#cfcfcf] p-[6px_10px] text-right ${bold ? "font-bold" : ""}`}
                >
                  {q3}
                </td>
                <td
                  className={`border border-[#cfcfcf] p-[6px_10px] text-right ${bold ? "font-bold" : ""}`}
                >
                  {qoq}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mb-3 text-justify text-[13.5px] leading-[1.75]">
          Operating leverage was the story of the quarter: revenue grew 18%
          while operating expenses rose under 10%, converting incremental gross
          profit almost entirely to EBITDA. Net revenue retention held at 119%.
        </p>
        <p className="text-justify text-[13.5px] leading-[1.75]">
          Management recommends the board approve the revised full-year guidance
          range on the basis presented in Appendix B.
        </p>
      </div>
    </div>
  );
}
