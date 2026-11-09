package com.ticketrush.config;

import com.ticketrush.model.entity.Voucher;
import com.ticketrush.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class VoucherDataInitializer implements CommandLineRunner {

    private final VoucherRepository voucherRepository;

    @Override
    public void run(String... args) {
        seedVoucherIfMissing("RUSH100", "Giảm ngay 100.000 đ cho đơn hàng từ 500.000 đ",
                "FIXED_AMOUNT", 100000.0, null, 500000.0, 1000);

        seedVoucherIfMissing("SALE10", "Giảm 10% tối đa 200.000 đ cho mọi đơn hàng",
                "PERCENTAGE", 10.0, 200000.0, 0.0, 500);

        seedVoucherIfMissing("VIP50", "Ưu đãi VIP giảm 50.000 đ cho đơn từ 100.000 đ",
                "FIXED_AMOUNT", 50000.0, null, 100000.0, 200);
    }

    private void seedVoucherIfMissing(String code, String description, String type,
                                      Double value, Double maxDiscount, Double minOrderPrice, int quantity) {
        if (voucherRepository.findByCodeIgnoreCase(code).isEmpty()) {
            Voucher voucher = new Voucher();
            voucher.setCode(code.toUpperCase());
            voucher.setDescription(description);
            voucher.setDiscountType(type);
            voucher.setDiscountValue(value);
            voucher.setMaxDiscount(maxDiscount);
            voucher.setMinOrderPrice(minOrderPrice);
            voucher.setTotalQuantity(quantity);
            voucher.setUsedQuantity(0);
            voucher.setActive(true);
            voucher.setStartDate(LocalDateTime.now().minusDays(1));
            voucher.setEndDate(LocalDateTime.now().plusMonths(6));
            voucherRepository.save(voucher);
            log.info("Initialized test voucher: {}", code);
        }
    }
}

