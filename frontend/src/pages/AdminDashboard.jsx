import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarClock, CreditCard, PlusCircle, Ticket } from "lucide-react";
import { adminApi } from "../api/adminApi";
import { useAuth } from "../hooks/useAuth";
import { PageHeader, QueryState, Table } from "../components/admin/AdminSurface";
import { money, number, dateTime } from "../utils/adminFormat";

const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default function AdminDashboard() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ["admin-overview", user.id], queryFn: adminApi.overview, refetchInterval: 30000 });
  const eventsQuery = useQuery({ queryKey: ["admin-events", user.id], queryFn: adminApi.events });
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const kickoff = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);
  const data = query.data;
  const actions = useMemo(() => {
    if (!data) return [];
    const pendingOrders = (data.recentOrders || []).filter((order) => order.status === "PENDING");
    const upcoming = (eventsQuery.data || []).filter((event) =>
      (event.showtimes || []).some((showtime) => {
        const start = new Date(showtime.startTime).getTime();
        return Number.isFinite(start) && start >= now && start <= now + UPCOMING_WINDOW_MS;
      }),
    );
    return [
      {
        id: "orders",
        icon: CreditCard,
        title: "Đơn chờ thanh toán",
        value: pendingOrders.length,
        note: pendingOrders.length ? "Trong 5 đơn gần nhất; kiểm tra trước khi hết hạn giữ ghế." : "Không có đơn chờ trong 5 đơn gần nhất.",
        to: "/admin",
      },
      {
        id: "upcoming",
        icon: CalendarClock,
        title: "Sự kiện trong 7 ngày tới",
        value: upcoming.length,
        note: upcoming.length ? "Mở sự kiện để kiểm tra suất diễn và tình trạng bán vé." : "Không có sự kiện nào trong 7 ngày tới.",
        to: upcoming[0] ? `/event/${upcoming[0].id}` : "/admin/events",
      },
      {
        id: "vouchers",
        icon: Ticket,
        title: "Voucher đang bật",
        value: data.activeVouchers ?? 0,
        note: data.activeVouchers ? "Theo dõi lượt dùng và tắt mã khi đã hết hạn." : "Chưa có voucher nào đang bật.",
        to: "/admin/vouchers",
      },
    ];
  }, [data, eventsQuery.data, now]);

  return <div className="admin-page">
    <PageHeader title="Tổng quan hệ thống" description="Doanh thu và vé từ đơn hoàn tất. Tự cập nhật mỗi 30 giây.">
      <button disabled={query.isFetching} onClick={() => query.refetch()}>Làm mới</button>
    </PageHeader>
    <QueryState query={query}>{data && <>
      <dl className="admin-metrics">
        <div><dt>Tổng doanh thu</dt><dd>{money(data.totalRevenue)}</dd></div>
        <div><dt>Vé đã bán</dt><dd>{number(data.totalTicketsSold)}</dd></div>
        <div><dt>Khách hàng đăng ký</dt><dd>{number(data.totalUsers)}</dd></div>
      </dl>
      <p className="admin-muted mt-4">{number(data.totalEvents)} sự kiện · {number(data.activeVouchers)} voucher đang bật</p>
      <section className="admin-section">
        <h2>Việc cần xử lý</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.id}
                to={action.to}
                className="rounded-xl border border-line bg-surface p-4 no-underline transition-colors hover:border-primary/30"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/5 text-primary">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="price text-2xl font-black text-text">{action.value}</span>
                </span>
                <span className="mt-3 block text-sm font-bold text-text">{action.title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted">{action.note}</span>
              </Link>
            );
          })}
          <Link
            to="/admin/add-event"
            className="flex flex-col justify-center rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 no-underline transition-colors hover:bg-primary/10"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-primary">
              <PlusCircle size={18} aria-hidden="true" />
              Tạo sự kiện mới
            </span>
            <span className="mt-1 text-xs leading-5 text-muted">
              Bắt đầu từ thông tin, sơ đồ ghế và hạng vé.
            </span>
          </Link>
        </div>
      </section>
      <section className="admin-section"><h2>Sự kiện có doanh thu cao nhất</h2>
        {data.topEvents.length ? <Table label="Doanh thu sự kiện"><thead><tr><th>Sự kiện</th><th>Doanh thu</th><th>Vé đã bán</th><th>Lấp đầy</th></tr></thead><tbody>
          {data.topEvents.map(event => <tr key={event.id}><td><Link className="underline underline-offset-4" to={`/event/${event.id}`}>{event.eventName}</Link></td><td>{money(event.revenue)}</td><td>{number(event.ticketsSold)} / {number(event.totalSeats)}</td><td>{event.occupancyRate.toFixed(1)}%</td></tr>)}
        </tbody></Table> : <p className="admin-muted">Chưa có sự kiện. <Link className="underline" to="/admin/add-event">Tạo sự kiện đầu tiên</Link>.</p>}
      </section>
      <section className="admin-section"><h2>Hiệu quả voucher</h2>
        {data.voucherSummary.length ? <Table label="Hiệu quả voucher"><thead><tr><th>Mã</th><th>Trạng thái</th><th>Đơn hoàn tất</th><th>Khách đã tiết kiệm</th></tr></thead><tbody>
          {data.voucherSummary.map(v => <tr key={v.id}><td className="admin-code">{v.code}</td><td>{v.active ? "Đang bật" : "Đã tắt"}</td><td>{number(v.usageCount)}</td><td>{money(v.totalSaved)}</td></tr>)}
        </tbody></Table> : <p className="admin-muted">Chưa có voucher.</p>}
        <Link className="inline-block mt-4 underline underline-offset-4" to="/admin/vouchers">Quản lý voucher</Link>
      </section>
      <section className="admin-section"><h2>5 đơn gần nhất</h2>
        {data.recentOrders.length ? <Table label="Đơn hàng gần đây"><thead><tr><th>Đơn / khách hàng</th><th>Sự kiện</th><th>Thành tiền</th><th>Trạng thái</th><th>Tạo lúc</th></tr></thead><tbody>
          {data.recentOrders.map(order => <tr key={order.orderId}><td><span title={order.orderId}>#{order.orderId.slice(0,8)}</span><div className="admin-muted">{order.userEmail}</div></td><td>{order.eventName || "Không còn vé nháp"}</td><td>{money(order.totalPrice)}</td><td>{({ COMPLETED: "Hoàn tất", PENDING: "Chờ thanh toán", EXPIRED: "Hết hạn" })[order.status] || order.status}</td><td>{dateTime(order.createdAt)}</td></tr>)}
        </tbody></Table> : <p className="admin-muted">Chưa có đơn hàng.</p>}
      </section>
    </>}</QueryState>
  </div>;
}
