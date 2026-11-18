package com.ticketrush.config;

import com.ticketrush.model.entity.Voucher;
import com.ticketrush.repository.VoucherRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class VoucherDataInitializerTest {

    @Test
    void seedsTheThreeDemoVouchersWhenTheyAreMissing() {
        VoucherRepository repository = mock(VoucherRepository.class);
        when(repository.findByCodeIgnoreCase(anyString())).thenReturn(Optional.empty());

        new VoucherDataInitializer(repository).run();

        ArgumentCaptor<Voucher> saved = ArgumentCaptor.forClass(Voucher.class);
        verify(repository, times(3)).save(saved.capture());
        List<Voucher> vouchers = saved.getAllValues();
        assertEquals(
                List.of("RUSH100", "SALE10", "VIP50"),
                vouchers.stream().map(Voucher::getCode).toList());
        assertTrue(vouchers.stream().allMatch(Voucher::getActive));
    }

    @Test
    void leavesExistingVouchersUntouched() {
        VoucherRepository repository = mock(VoucherRepository.class);
        when(repository.findByCodeIgnoreCase(anyString())).thenReturn(Optional.of(new Voucher()));

        new VoucherDataInitializer(repository).run();

        verify(repository, never()).save(any(Voucher.class));
    }
}
