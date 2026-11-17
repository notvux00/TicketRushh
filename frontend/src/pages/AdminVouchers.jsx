import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api/adminApi";
import { eventApi } from "../api/eventApi";
import { useAuth } from "../hooks/useAuth";
import { PageHeader, QueryState, Table } from "../components/admin/AdminSurface";
import { money, number, dateTime, errorText } from "../utils/adminFormat";

const initial = { code: "", discountType: "FIXED_AMOUNT", discountValue: "", description: "", expiresAt: "", maxUsage: "", maxDiscount: "", minOrderPrice: "", eventId: "" };

export default function AdminVouchers() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("");
  const query = useQuery({ queryKey: ["admin-vouchers", user.id], queryFn: adminApi.vouchers });
  const events = useQuery({ queryKey: ["admin-voucher-events", user.id], queryFn: eventApi.getAllEvents, enabled: open });
  const mutation = useMutation({
    mutationFn: ({ action, value }) => ({ create: adminApi.createVoucher, toggle: adminApi.toggleVoucher, delete: adminApi.deleteVoucher })[action](value),
    onSuccess: (_data, { action }) => {
      client.invalidateQueries({ queryKey: ["admin-vouchers"] });
      client.invalidateQueries({ queryKey: ["admin-overview"] });
      setMessage(action === "create" ? "Đã tạo voucher." : action === "delete" ? "Đã xóa voucher." : "Đã cập nhật trạng thái.");
      if (action === "create") { setForm(initial); setOpen(false); }
    },
  });
  const field = name => ({ value: form[name], onChange: e => setForm(previous => ({ ...previous, [name]: e.target.value })) });
  const submit = e => {
    e.preventDefault(); setMessage("");
    mutation.mutate({ action: "create", value: { ...form,
      discountValue: Number(form.discountValue),
      maxUsage: form.maxUsage ? Number(form.maxUsage) : null,
      minOrderPrice: form.minOrderPrice ? Number(form.minOrderPrice) : null,
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
      expiresAt: form.expiresAt ? `${form.expiresAt}:00+07:00` : null,
      eventId: form.eventId || null,
    } });
  };
  return <div className="admin-page">
    <PageHeader title="Quản lý voucher" description="Tạo ưu đãi và theo dõi số đơn hoàn tất đã sử dụng.">
      <button className="admin-primary" onClick={() => { setOpen(value => !value); mutation.reset(); }} aria-expanded={open}>Tạo voucher</button>
    </PageHeader>
    {message && <p role="status" className="admin-notice admin-success">{message}</p>}
    {mutation.isError && <p role="alert" className="admin-notice admin-error">{errorText(mutation.error)}</p>}
    {open && <section className="admin-panel mb-8" aria-label="Tạo voucher mới"><h2>Tạo voucher mới</h2>
      <form className="admin-form" onSubmit={submit}>
        <label>Mã voucher<input {...field("code")} required pattern="[A-Z0-9]{4,20}" maxLength={20} placeholder="SUMMER2027" title="4–20 ký tự, chỉ chữ hoa và số" /></label>
        <label>Loại giảm<select {...field("discountType")}><option value="FIXED_AMOUNT">Số tiền cố định</option><option value="PERCENTAGE">Phần trăm</option></select></label>
        <label>Giá trị giảm {form.discountType === "PERCENTAGE" ? "(%)" : "(đ)"}<input {...field("discountValue")} type="number" required min="1" step="any" max={form.discountType === "PERCENTAGE" ? 100 : undefined} /></label>
        <label>Giới hạn lượt dùng<input {...field("maxUsage")} type="number" min="1" step="1" placeholder="Trống = không giới hạn" /></label>
        <label>Hạn dùng (giờ Việt Nam)<input {...field("expiresAt")} type="datetime-local" /></label>
        <label>Giảm tối đa (đ)<input {...field("maxDiscount")} type="number" min="1" step="any" placeholder="Không giới hạn" /></label>
        <label>Đơn tối thiểu (đ)<input {...field("minOrderPrice")} type="number" min="0" step="any" /></label>
        <label>Phạm vi sự kiện<select {...field("eventId")} disabled={events.isPending || events.isError}><option value="">Tất cả sự kiện</option>{events.data?.map(event => <option key={event.id} value={event.id}>{event.eventName}</option>)}</select></label>
        {events.isError && <p role="alert" className="admin-muted admin-wide">Không tải được sự kiện. <button type="button" onClick={() => events.refetch()}>Thử lại</button></p>}
        <label className="admin-wide">Mô tả<input {...field("description")} maxLength={255} /></label>
        <div className="admin-actions admin-wide"><button className="admin-primary" disabled={mutation.isPending} type="submit">{mutation.isPending ? "Đang lưu…" : "Lưu voucher"}</button><button type="button" disabled={mutation.isPending} onClick={() => setOpen(false)}>Đóng</button></div>
      </form>
    </section>}
    <QueryState query={query}>{query.data?.length ? <Table label="Danh sách voucher"><thead><tr><th>Mã / loại</th><th>Giá trị</th><th>Hạn dùng</th><th>Đơn / giới hạn</th><th>Đã tiết kiệm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {query.data.map(v => <tr key={v.id}><td><div className="admin-code">{v.code}</div><div className="admin-muted">{v.discountType === "PERCENTAGE" ? "Phần trăm" : "Cố định"}</div>{v.eventName && <div className="admin-muted">{v.eventName}</div>}</td><td>{v.discountType === "PERCENTAGE" ? `${v.discountValue}%` : money(v.discountValue)}</td><td>{v.expiresAt ? dateTime(v.expiresAt) : "Không hết hạn"}</td><td>{number(v.usageCount)} / {v.maxUsage ?? "Không giới hạn"}</td><td>{money(v.totalSaved)}</td><td>{!v.active ? "Đã tắt" : v.expiresAt && new Date(v.expiresAt) <= new Date() ? "Đã hết hạn" : v.maxUsage != null && v.usedQuantity >= v.maxUsage ? "Đã dùng hết" : "Đang bật"}</td><td><div className="admin-actions"><button disabled={mutation.isPending} aria-label={`${v.active ? "Tắt" : "Bật"} ${v.code}`} onClick={() => mutation.mutate({ action: "toggle", value: v.id })}>{v.active ? "Tắt" : "Bật"}</button><button className="admin-danger" disabled={mutation.isPending || !v.canDelete} title={v.canDelete ? "Xóa voucher chưa dùng" : "Đã gắn với đơn hàng; hãy tắt thay vì xóa"} aria-label={`Xóa ${v.code}`} onClick={() => { if (window.confirm(`Xóa voucher ${v.code}?`)) mutation.mutate({ action: "delete", value: v.id }); }}>Xóa</button></div></td></tr>)}
    </tbody></Table> : query.isSuccess && <p className="admin-notice">Chưa có voucher. Chọn “Tạo voucher” để thêm ưu đãi đầu tiên.</p>}</QueryState>
  </div>;
}
