import { useUiStore } from "../../lib/store";
import { excel } from "../../lib/mock";

const totalRe = /total|gross profit|ebitda margin|ebitda|weighted/i;
const letters = "ABCDEFGHIJ".split("");

function cellClass(
  head: boolean,
  hi: boolean,
  bold: boolean,
  rightAlign: boolean
) {
  return [
    "border-r border-b border-n3 px-[10px] py-[5px] text-[12.5px] text-[#26221f] overflow-hidden whitespace-nowrap text-ellipsis",
    head
      ? "bg-n1 font-bold"
      : hi
        ? "bg-[#fff2ef] shadow-[inset_0_0_0_2px_var(--accent)]"
        : "bg-white",
    rightAlign ? "text-right tabular-nums" : "text-left",
    bold && !head ? "font-bold" : "",
  ].join(" ");
}

export function XlsxBody() {
  const activeSheet = useUiStore((s) => s.activeSheet);
  const sh = excel[activeSheet];
  const widths = sh.headers.map((_, i) => (i === 0 ? 210 : 118));

  return (
    <div className="min-w-max font-sans">
      <div className="sticky top-0 z-[3] flex">
        <div className="w-[42px] flex-none border-r border-b border-n5 bg-n3" />
        {sh.headers.map((_, i) => (
          <div
            key={i}
            style={{ width: widths[i] }}
            className="flex-none border-r border-b border-n5 bg-n3 px-2 py-1 text-center text-[11px] font-semibold text-[#4a4747]"
          >
            {letters[i]}
          </div>
        ))}
      </div>
      <div className="flex">
        <div className="w-[42px] flex-none border-r border-b border-n3 bg-n2 py-[5px] text-center text-[11px] text-[#8a8686]">
          1
        </div>
        <div className="flex-1 border-r border-b border-n3 bg-n1 px-3 py-[6px] text-[13px] font-bold text-[#26221f]">
          {sh.title}
        </div>
      </div>
      <div className="flex">
        <div className="w-[42px] flex-none border-r border-b border-n3 bg-n2 py-[5px] text-center text-[11px] text-[#8a8686]">
          2
        </div>
        {sh.headers.map((h, i) => (
          <div
            key={i}
            style={{ width: widths[i] }}
            className={cellClass(true, false, false, i > 0)}
          >
            {h}
          </div>
        ))}
      </div>
      {sh.rows.map((r, ri) => (
        <div key={ri} className="flex">
          <div className="w-[42px] flex-none border-r border-b border-n3 bg-n2 py-[5px] text-center text-[11px] text-[#8a8686]">
            {ri + 3}
          </div>
          {r.map((v, ci) => (
            <div
              key={ci}
              style={{ width: widths[ci] }}
              className={cellClass(
                false,
                sh.hi[0] === ri && sh.hi[1] === ci,
                ci !== 0 && totalRe.test(r[0]),
                ci > 0
              )}
            >
              {v}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
