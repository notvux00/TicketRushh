package com.ticketrush.service;

import com.ticketrush.model.dto.CreateVoucherRequest;
import com.ticketrush.model.entity.Voucher;
import com.ticketrush.repository.EventRepository;
import com.ticketrush.repository.VoucherRepository;
import com.ticketrush.util.EventTime;
import com.ticketrush.util.PriceValidation;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AdminVoucherService {
    private final VoucherRepository vouchers;
    private final EventRepository events;
    private final JdbcTemplate db;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        return db.query("""
                SELECT v.*, e.event_name,
                  count(o.id) AS linked_orders,
                  count(o.id) FILTER (WHERE o.status='COMPLETED') AS usage_count,
                  coalesce(sum(o.discount_amount) FILTER (WHERE o.status='COMPLETED'),0) AS total_saved
                FROM vouchers v LEFT JOIN orders o ON o.voucher_id=v.id
                LEFT JOIN events e ON e.id=v.event_id
                GROUP BY v.id,e.event_name ORDER BY v.created_at DESC,v.id
                """, (r, n) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", r.getObject("id")); row.put("code", r.getString("code"));
            row.put("description", r.getString("description"));
            row.put("discountType", r.getString("discount_type")); row.put("discountValue", r.getDouble("discount_value"));
            row.put("maxDiscount", r.getObject("max_discount")); row.put("minOrderPrice", r.getObject("min_order_price"));
            row.put("expiresAt", utc(r.getObject("end_date", LocalDateTime.class)));
            row.put("maxUsage", r.getObject("total_quantity")); row.put("usedQuantity", r.getInt("used_quantity"));
            row.put("active", r.getBoolean("active")); row.put("usageCount", r.getLong("usage_count"));
            row.put("totalSaved", r.getDouble("total_saved")); row.put("createdAt", utc(r.getObject("created_at", LocalDateTime.class)));
            row.put("canDelete", r.getLong("linked_orders") == 0 && r.getInt("used_quantity") == 0);
            row.put("createdBy", r.getString("created_by")); row.put("eventId", r.getObject("event_id"));
            row.put("eventName", r.getString("event_name"));
            return row;
        });
    }

    public static Object utc(LocalDateTime value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC).atZoneSameInstant(EventTime.ZONE).toOffsetDateTime();
    }

    @Transactional
    public Map<String, Object> create(CreateVoucherRequest request, String creator) {
        String type = switch (request.discountType()) {
            case "FIXED", "FIXED_AMOUNT" -> "FIXED_AMOUNT";
            case "PERCENT", "PERCENTAGE" -> "PERCENTAGE";
            default -> throw new IllegalArgumentException("Loại giảm giá không hợp lệ");
        };
        PriceValidation.requireValid(request.discountValue());
        if (request.discountValue() <= 0 || (type.equals("PERCENTAGE") && request.discountValue() > 100))
            throw new IllegalArgumentException("Giá trị giảm phải dương; phần trăm không vượt quá 100");
        if (request.maxDiscount() != null) PriceValidation.requireValid(request.maxDiscount());
        if (request.minOrderPrice() != null) PriceValidation.requireValid(request.minOrderPrice());
        if (request.expiresAt() != null && !request.expiresAt().isAfter(LocalDateTime.now(EventTime.ZONE)))
            throw new IllegalArgumentException("Hạn dùng phải ở tương lai");
        if (vouchers.findByCodeIgnoreCase(request.code()).isPresent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã voucher đã tồn tại");
        Voucher voucher = new Voucher();
        voucher.setCode(request.code()); voucher.setDescription(request.description());
        voucher.setDiscountType(type); voucher.setDiscountValue(request.discountValue());
        voucher.setMaxDiscount(request.maxDiscount()); voucher.setMinOrderPrice(request.minOrderPrice());
        voucher.setEndDate(request.expiresAt()); voucher.setTotalQuantity(request.maxUsage());
        voucher.setCreatedBy(creator);
        if (request.eventId() != null) voucher.setEvent(events.findById(request.eventId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sự kiện không tồn tại")));
        vouchers.saveAndFlush(voucher);
        return findSummary(voucher.getId());
    }

    @Transactional
    public Map<String, Object> toggle(UUID id) {
        Voucher voucher = locked(id);
        voucher.setActive(!Boolean.TRUE.equals(voucher.getActive()));
        vouchers.saveAndFlush(voucher);
        return findSummary(id);
    }

    @Transactional
    public void delete(UUID id) {
        Voucher voucher = locked(id);
        if (voucher.getUsedQuantity() > 0 || db.queryForObject("SELECT count(*) FROM orders WHERE voucher_id=?", Long.class, id) > 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Voucher đã gắn với đơn hàng; hãy tắt thay vì xóa");
        vouchers.delete(voucher); vouchers.flush();
    }

    private Voucher locked(UUID id) {
        return vouchers.findForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Voucher không tồn tại"));
    }

    private Map<String, Object> findSummary(UUID id) {
        return list().stream().filter(v -> id.equals(v.get("id"))).findFirst().orElseThrow();
    }
}
