import "./admin.css";
import { errorText } from "../../utils/adminFormat";


export function PageHeader({ title, description, children }) {
  return <header className="admin-heading"><div><h1>{title}</h1><p>{description}</p></div><div className="admin-actions">{children}</div></header>;
}
export function QueryState({ query, children }) {
  if (query.isPending) return <p role="status" className="admin-notice">Đang tải dữ liệu…</p>;
  if (query.isError && !query.data) return <div role="alert" className="admin-notice admin-error"><p>{errorText(query.error)}</p><button onClick={() => query.refetch()}>Thử lại</button></div>;
  return <>{query.isRefetchError && <p role="alert" className="admin-notice admin-error">Cập nhật thất bại. Đang hiển thị dữ liệu lần tải trước.</p>}{children}</>;
}
export function Table({ children, label }) {
  return <div className="admin-table-wrap" role="region" aria-label={label} tabIndex={0}><table className="admin-table">{children}</table></div>;
}
