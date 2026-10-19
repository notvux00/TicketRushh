import {
  Ticket,
  Share2,
  Globe,
  Users,
  CreditCard,
  Landmark,
  ShieldCheck,
} from "lucide-react";

function Footer() {
  return (
    <footer className="bg-primary text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
          {/* Brand & Social */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Ticket className="rotate-[-15deg]" size={32} />
              <h2 className="text-xl font-extrabold tracking-tight uppercase">
                TicketRush
              </h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-8">
              Nền tảng đặt vé sự kiện cao cấp cho các chương trình ca nhạc, thể 
              thao và trải nghiệm văn hóa độc quyền hàng đầu thế giới. Sống trọn 
              từng khoảnh khắc.
            </p>
            <div className="flex gap-4">
              {[
                { icon: <Share2 size={20} />, label: "Chia sẻ" },
                { icon: <Globe size={20} />, label: "Ngôn ngữ" },
                { icon: <Users size={20} />, label: "Nhóm" },
              ].map((item, idx) => (
                <a
                  key={idx}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                  href="#"
                >
                  {item.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Explore Links */}
          <div>
            <h4 className="font-bold text-lg mb-6 uppercase tracking-widest text-xs">
              Khám phá
            </h4>
            <ul className="space-y-4">
              {[
                { label: "Sự kiện xu hướng", key: "Trending" },
                { label: "Âm nhạc & Concert", key: "Music" },
                { label: "Thể thao", key: "Sports" },
                { label: "Sân khấu & Nghệ thuật", key: "Arts" },
                { label: "Workshop", key: "Workshops" },
              ].map((link) => (
                <li key={link.key}>
                  <a
                    className="text-white/60 hover:text-white transition-colors text-sm"
                    href="#"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* About Us Links */}
          <div>
            <h4 className="font-bold text-lg mb-6 uppercase tracking-widest text-xs">
              Về chúng tôi
            </h4>
            <ul className="space-y-4">
              {[
                { label: "Câu chuyện của chúng tôi", key: "Story" },
                { label: "Điều khoản dịch vụ", key: "Terms" },
                { label: "Chính sách bảo mật", key: "Privacy" },
                { label: "Trung tâm hỗ trợ", key: "Support" },
                { label: "Thẻ quà tặng", key: "Gifts" },
              ].map((link) => (
                <li key={link.key}>
                  <a
                    className="text-white/60 hover:text-white transition-colors text-sm"
                    href="#"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="col-span-1">
            <h4 className="font-bold text-lg mb-6 uppercase tracking-widest text-xs">
              Liên hệ
            </h4>
            <p className="text-white/60 text-sm mb-6 italic">
              Bạn có câu hỏi? Đội ngũ của chúng tôi luôn sẵn sàng hỗ trợ 24/7 để
              giúp bạn đặt vé một cách nhanh chóng nhất.
            </p>
            <a
              className="text-white font-bold text-sm hover:text-white/80 transition-colors"
              href="mailto:support@ticketrush.com"
            >
              support@ticketrush.com
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
            © 2026 TicketRush. Bản quyền đã được bảo hộ.
          </p>
          <div className="flex gap-8">
            <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
              Thanh toán an toàn & bảo mật
            </span>
            <div className="flex gap-4 opacity-40">
              <CreditCard size={20} />
              <Landmark size={20} />
              <ShieldCheck size={20} />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
