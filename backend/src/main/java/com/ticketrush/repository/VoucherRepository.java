package com.ticketrush.repository;

import com.ticketrush.model.entity.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VoucherRepository extends JpaRepository<Voucher, UUID> {
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query("""
            update Voucher v set v.usedQuantity = coalesce(v.usedQuantity, 0) + 1
            where v.id = :id and v.active = true
              and (v.startDate is null or v.startDate <= :now)
              and (v.endDate is null or v.endDate >= :now)
              and (v.totalQuantity is null or coalesce(v.usedQuantity, 0) < v.totalQuantity)
            """)
    int consumeAvailableUse(@org.springframework.data.repository.query.Param("id") UUID id,
                            @org.springframework.data.repository.query.Param("now") java.time.LocalDateTime now);

    Optional<Voucher> findByCodeIgnoreCase(String code);
    Optional<Voucher> findByCodeIgnoreCaseAndActiveTrue(String code);
    List<Voucher> findByActiveTrueOrderByMinOrderPriceAsc();
}

