import { MapPin } from "lucide-react";
import { ZONE_COLORS, CANVAS_W, CANVAS_H } from "../../constants/zoneColors";

export default function VenueSeatMap({ zones = [] }) {
  const uniqueNames = Array.from(new Set((zones || []).map((z) => z.name.trim())));
  const colorMap = {};
  uniqueNames.forEach((name, i) => {
    colorMap[name] = ZONE_COLORS[i % ZONE_COLORS.length];
  });

  return (
    <section className="space-y-4">
      <h4 className="text-base font-black text-primary uppercase tracking-widest flex items-center gap-2.5 mb-2">
        <MapPin size={14} /> Sơ đồ hội trường
      </h4>
      {/* Wrapper scroll ngang nếu modal hẹp hơn canvas */}
      <div className="overflow-x-auto rounded-2xl">
        <div
          className="mx-auto relative bg-[#F1F5F9] rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundImage: "radial-gradient(#CBD5E1 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        >
          {/* Sân khấu */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-8 bg-slate-900 text-white flex items-center justify-center text-[11px] font-black tracking-[0.6em] rounded-b-xl z-10">
            SÂN KHẤU
          </div>
          {/* Render zones với tọa độ 1:1 (cùng canvas CANVAS_W x CANVAS_H) */}
          {zones?.map((zone) => (
            <div
              key={zone.id}
              className="absolute rounded-xl border-2 border-white/60 shadow-lg flex flex-col"
              style={{
                left: zone.positionX || 0,
                top: zone.positionY || 0,
                width: zone.visualWidth || 160,
                height: zone.visualHeight || 120,
                backgroundColor: colorMap[zone.name.trim()] || "#CBD5E1",
              }}
            >
              <div className="p-1.5 bg-black/20 text-white text-[8px] font-black uppercase truncate rounded-t-xl">
                {zone.name}
              </div>
              <div
                className="flex-1 m-1 rounded-lg opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, white 1px, transparent 1.5px)",
                  backgroundSize: `${100 / zone.matrixCol}% ${100 / zone.matrixRow}%`,
                }}
              />
            </div>
          ))}
          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 pointer-events-none z-20">
            {uniqueNames.map((name, idx) => (
              <div
                key={idx}
                className="bg-white/90 px-2.5 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shadow-inner"
                  style={{ backgroundColor: colorMap[name] }}
                />
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tighter">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
