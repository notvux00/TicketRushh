package com.ticketrush.service;

import com.ticketrush.model.dto.CheckoutSessionResponse;
import com.ticketrush.model.entity.*;
import com.ticketrush.repository.OrderRepository;
import com.ticketrush.repository.SeatRepository;
import com.ticketrush.repository.TicketRepository;
import com.ticketrush.repository.UserRepository;
import com.ticketrush.repository.VoucherRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VoucherServiceTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private SeatRepository seatRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private VoucherRepository voucherRepository;
    @Mock
    private SeatLockService seatLockService;
    @Mock
    private VirtualQueueService virtualQueueService;
    @Mock
    private TicketSignatureService ticketSignatureService;

    @InjectMocks
    private CheckoutService checkoutService;

    private UUID userId;
    private UUID orderId;
    private Order mockOrder;
    private Ticket mockTicket;
    private Event mockEvent;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        orderId = UUID.randomUUID();

        User user = new User();
        user.setId(userId);

        mockOrder = new Order();
        mockOrder.setId(orderId);
        mockOrder.setUser(user);
        mockOrder.setStatus("PENDING");
        mockOrder.setOriginalPrice(1000000.0);
        mockOrder.setTotalPrice(1000000.0);
        mockOrder.setDiscountAmount(0.0);
        mockOrder.setExpiresAt(LocalDateTime.now().plusMinutes(10));

        mockEvent = new Event();
        mockEvent.setId(UUID.randomUUID());
        mockEvent.setEventName("Anh Trai Say Hi Concert");

        Showtime showtime = new Showtime();
        showtime.setId(UUID.randomUUID());
        showtime.setEvent(mockEvent);

        Zone zone = new Zone();
        zone.setName("VIP Zone");
        zone.setPrice(1000000.0);
        zone.setShowtime(showtime);

        Seat seat = new Seat();
        seat.setId(UUID.randomUUID());
        seat.setSeatLabel("A1");
        seat.setZone(zone);

        mockTicket = new Ticket();
        mockTicket.setId(UUID.randomUUID());
        mockTicket.setOrder(mockOrder);
        mockTicket.setSeat(seat);

        lenient().when(orderRepository.findById(orderId)).thenReturn(Optional.of(mockOrder));
        lenient().when(ticketRepository.findByOrderId(orderId)).thenReturn(List.of(mockTicket));
    }

    @Test
    @DisplayName("TC-01: Áp mã cố định thành công - Giảm thẳng 100k cho đơn 1tr")
    void testApplyVoucher_FixedAmount_Success() {
        Voucher voucher = new Voucher();
        voucher.setCode("RUSH100");
        voucher.setDiscountType("FIXED_AMOUNT");
        voucher.setDiscountValue(100000.0);
        voucher.setMinOrderPrice(500000.0);
        voucher.setTotalQuantity(1000);
        voucher.setUsedQuantity(0);
        voucher.setActive(true);

        when(voucherRepository.findByCodeIgnoreCaseAndActiveTrue("RUSH100")).thenReturn(Optional.of(voucher));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        CheckoutSessionResponse response = checkoutService.applyVoucher(orderId, "RUSH100", userId.toString());

        assertNotNull(response);
        assertEquals(900000.0, response.getTotalPrice());
        assertEquals(1000000.0, response.getOriginalPrice());
        assertEquals(100000.0, response.getDiscountAmount());
        assertEquals("RUSH100", response.getVoucherCode());
        assertTrue(response.getQrCodeUrl().contains("amount=900000"));
    }

    @Test
    @DisplayName("TC-02: Áp mã phần trăm có giới hạn tối đa (10% tối đa 200k)")
    void testApplyVoucher_PercentageWithMaxCap() {
        mockOrder.setOriginalPrice(3000000.0);
        mockOrder.setTotalPrice(3000000.0);

        Voucher voucher = new Voucher();
        voucher.setCode("SALE10");
        voucher.setDiscountType("PERCENTAGE");
        voucher.setDiscountValue(10.0); // 10% of 3M = 300k
        voucher.setMaxDiscount(200000.0); // Cap at 200k
        voucher.setMinOrderPrice(0.0);
        voucher.setTotalQuantity(500);
        voucher.setUsedQuantity(10);
        voucher.setActive(true);

        when(voucherRepository.findByCodeIgnoreCaseAndActiveTrue("SALE10")).thenReturn(Optional.of(voucher));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        CheckoutSessionResponse response = checkoutService.applyVoucher(orderId, "SALE10", userId.toString());

        assertNotNull(response);
        assertEquals(2800000.0, response.getTotalPrice()); // 3M - 200k
        assertEquals(200000.0, response.getDiscountAmount());
        assertEquals("SALE10", response.getVoucherCode());
    }

    @Test
    @DisplayName("TC-03: Báo lỗi khi đơn hàng chưa đạt giá trị tối thiểu")
    void testApplyVoucher_MinOrderPriceNotMet() {
        mockOrder.setOriginalPrice(300000.0);
        mockOrder.setTotalPrice(300000.0);

        Voucher voucher = new Voucher();
        voucher.setCode("RUSH100");
        voucher.setDiscountType("FIXED_AMOUNT");
        voucher.setDiscountValue(100000.0);
        voucher.setMinOrderPrice(500000.0);
        voucher.setActive(true);

        when(voucherRepository.findByCodeIgnoreCaseAndActiveTrue("RUSH100")).thenReturn(Optional.of(voucher));

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                checkoutService.applyVoucher(orderId, "RUSH100", userId.toString())
        );

        assertTrue(ex.getMessage().contains("Đơn hàng tối thiểu phải từ"));
    }

    @Test
    @DisplayName("TC-04: Báo lỗi khi mã voucher không tồn tại hoặc hết hiệu lực")
    void testApplyVoucher_NotFound() {
        when(voucherRepository.findByCodeIgnoreCaseAndActiveTrue("INVALID")).thenReturn(Optional.empty());

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                checkoutService.applyVoucher(orderId, "INVALID", userId.toString())
        );

        assertTrue(ex.getMessage().contains("không tồn tại hoặc đã hết hiệu lực"));
    }

    @Test
    @DisplayName("TC-05: Báo lỗi khi voucher đã hết lượt sử dụng")
    void testApplyVoucher_OutOfStock() {
        Voucher voucher = new Voucher();
        voucher.setCode("VIP50");
        voucher.setActive(true);
        voucher.setTotalQuantity(100);
        voucher.setUsedQuantity(100);

        when(voucherRepository.findByCodeIgnoreCaseAndActiveTrue("VIP50")).thenReturn(Optional.of(voucher));

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                checkoutService.applyVoucher(orderId, "VIP50", userId.toString())
        );

        assertTrue(ex.getMessage().contains("hết lượt sử dụng"));
    }

    @Test
    @DisplayName("TC-06: Hủy áp dụng mã voucher - Khôi phục giá gốc")
    void testRemoveVoucher_Success() {
        Voucher voucher = new Voucher();
        voucher.setCode("RUSH100");
        mockOrder.setVoucher(voucher);
        mockOrder.setDiscountAmount(100000.0);
        mockOrder.setTotalPrice(900000.0);

        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        CheckoutSessionResponse response = checkoutService.removeVoucher(orderId, userId.toString());

        assertNotNull(response);
        assertEquals(1000000.0, response.getTotalPrice());
        assertEquals(0.0, response.getDiscountAmount());
        assertNull(response.getVoucherCode());
        assertTrue(response.getQrCodeUrl().contains("amount=1000000"));
    }
}
