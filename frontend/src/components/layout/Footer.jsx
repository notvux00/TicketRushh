import { CreditCard, Landmark, Mail, MapPin, Phone, ShieldCheck, Ticket } from "lucide-react";
import { Link } from "react-router-dom";

const exploreLinks = [
  { label: "Tất cả sự kiện", to: "/" },
  { label: "Âm nhạc", to: "/?category=CONCERT" },
  { label: "Sân khấu & Phim", to: "/?category=STAGE" },
  { label: "Thể thao", to: "/?category=SPORTS" },
  { label: "Workshop", to: "/?category=WORKSHOP" },
];

const accountLinks = [
  { label: "Vé của tôi", to: "/my-tickets" },
  { label: "Hồ sơ cá nhân", to: "/profile" },
  { label: "Liên hệ hỗ trợ", to: "mailto:support@ticketrush.vn" },
];

function Footer() {
  return (
    <footer className="bg-primary text-white">
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-14">
        <div className="grid grid-cols-1 gap-10 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-sm">
            <Link to="/" className="mb-4 flex items-center gap-2.5" aria-label="TicketRush — trang chủ">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Ticket size={20} className="-rotate-12" strokeWidth={2.4} />
              </span>
              <span className="text-lg font-extrabold tracking-tight">TicketRush</span>
            </Link>
            <p className="text-sm leading-6 text-white/65">
              Đặt vé sự kiện, chọn đúng chỗ ngồi và giữ vé điện tử trong một luồng liền mạch.
              Vé của bạn được ký số và kiểm tra tại cổng.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-bold text-white">Khám phá</h2>
            <ul className="space-y-2.5">
              {exploreLinks.map((link) => (
                <li key={link.label}>
                  <Link className="text-sm text-white/65 transition-colors hover:text-white" to={link.to}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-bold text-white">Dành cho khách</h2>
            <ul className="space-y-2.5">
              {accountLinks.map((link) => (
                <li key={link.label}>
                  <Link className="text-sm text-white/65 transition-colors hover:text-white" to={link.to}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-bold text-white">Liên hệ</h2>
            <ul className="space-y-3 text-sm text-white/65">
              <li className="flex items-start gap-2.5">
                <Mail size={16} className="mt-0.5 shrink-0 text-white/45" aria-hidden="true" />
                <a className="transition-colors hover:text-white" href="mailto:support@ticketrush.vn">
                  support@ticketrush.vn
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone size={16} className="mt-0.5 shrink-0 text-white/45" aria-hidden="true" />
                <span>1900 1234 · 8:00–22:00</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-white/45" aria-hidden="true" />
                <span>TP. Hồ Chí Minh, Việt Nam</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 TicketRush. Bản quyền đã được bảo hộ.</p>
          <div className="flex items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1.5">
              <ShieldCheck size={14} aria-hidden="true" />
              Thanh toán bảo mật
            </span>
            <CreditCard size={18} aria-hidden="true" />
            <Landmark size={18} aria-hidden="true" />
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
