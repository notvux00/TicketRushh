import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { useAuth } from "../hooks/useAuth";
import { PageHeader, QueryState, Table } from "../components/admin/AdminSurface";
import { money, number, dateTime } from "../utils/adminFormat";

export default function AdminDashboard() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ["admin-overview", user.id], queryFn: adminApi.overview, refetchInterval: 30000 });
  const data = query.data;
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
