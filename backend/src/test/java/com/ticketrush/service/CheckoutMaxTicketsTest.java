package com.ticketrush.service;

import com.ticketrush.model.dto.LockSeatRequest;
import com.ticketrush.model.entity.*;
import com.ticketrush.realtime.RealtimePublisher;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CheckoutMaxTicketsTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private SeatRepository seatRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private SeatLockService seatLockService;
    @Mock
    private RealtimePublisher realtimePublisher;
    @Mock
    private VirtualQueueService virtualQueueService;
    @Mock
    private TicketSignatureService ticketSignatureService;
    @Mock
    private VoucherRepository voucherRepository;

    @InjectMocks
    private CheckoutService checkoutService;

    private UUID showtimeId;
    private Event event;
    private Showtime showtime;
    private Zone zone;

    @BeforeEach
    void setUp() {
        showtimeId = UUID.randomUUID();
        event = new Event();
        event.setId(UUID.randomUUID());
        event.setEventName("Concert Test");

        showtime = new Showtime();
        showtime.setId(showtimeId);
        showtime.setStartTime(LocalDateTime.now().plusDays(2));
        showtime.setEvent(event);

        zone = new Zone();
        zone.setId(UUID.randomUUID());
        zone.setName("VIP");
        zone.setPrice(100_000.0);
        zone.setShowtime(showtime);
    }

    private List<Seat> createSeats(int count) {
        List<Seat> seats = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Seat s = new Seat();
            s.setId(UUID.randomUUID());
            s.setSeatLabel("A" + (i + 1));
            s.setStatus("AVAILABLE");
            s.setZone(zone);
            seats.add(s);
        }
        return seats;
    }

    @Test
    @DisplayName("TC-MAX01 & TC-MAX06: Ném lỗi khi vượt quá maxTicketsPerOrder do Admin cấu hình (Ví dụ: limit = 2, chọn 3)")
    void createSession_exceedsConfiguredMaxTickets_throwsException() {
        event.setMaxTicketsPerOrder(2);
        List<Seat> seats = createSeats(3);
        List<UUID> seatIds = seats.stream().map(Seat::getId).toList();

        LockSeatRequest request = new LockSeatRequest();
        request.setShowtimeId(showtimeId);
        request.setSeatIds(seatIds);

        when(seatRepository.findAllById(seatIds)).thenReturn(seats);

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                checkoutService.createSession(request, UUID.randomUUID().toString())
        );

        assertEquals("Max tickets per order exceeded", ex.getMessage());
    }

    @Test
    @DisplayName("TC-MAX07: Sử dụng giới hạn mặc định (4 vé) khi maxTicketsPerOrder là null và ném lỗi khi chọn 5 ghế")
    void createSession_defaultLimitFour_throwsWhenExceeding() {
        event.setMaxTicketsPerOrder(null); // Không cài đặt -> mặc định 4
        List<Seat> seats = createSeats(5);
        List<UUID> seatIds = seats.stream().map(Seat::getId).toList();

        LockSeatRequest request = new LockSeatRequest();
        request.setShowtimeId(showtimeId);
        request.setSeatIds(seatIds);

        when(seatRepository.findAllById(seatIds)).thenReturn(seats);

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                checkoutService.createSession(request, UUID.randomUUID().toString())
        );

        assertEquals("Max tickets per order exceeded", ex.getMessage());
    }

    @Test
    @DisplayName("Cho phép tạo phiên khi số vé nằm trong giới hạn maxTicketsPerOrder (Ví dụ: limit = 3, chọn 3)")
    void createSession_withinMaxTickets_passesLimitCheck() {
        event.setMaxTicketsPerOrder(3);
        List<Seat> seats = createSeats(3);
        List<UUID> seatIds = seats.stream().map(Seat::getId).toList();

        LockSeatRequest request = new LockSeatRequest();
        request.setShowtimeId(showtimeId);
        request.setSeatIds(seatIds);

        when(seatRepository.findAllById(seatIds)).thenReturn(seats);
        when(ticketRepository.findBySeatIdIn(seatIds)).thenReturn(List.of());

        User user = new User();
        user.setId(UUID.randomUUID());
        when(userRepository.findById(any())).thenReturn(java.util.Optional.of(user));

        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setUser(user);
        order.setTickets(new ArrayList<>());
        order.setTotalPrice(300_000.0);
        order.setCreatedAt(LocalDateTime.now());
        when(orderRepository.save(any(Order.class))).thenReturn(order);
        when(seatLockService.lockSeats(eq(showtimeId), eq(seatIds), anyString(), any())).thenReturn(true);

        List<Ticket> createdTickets = new ArrayList<>();
        when(ticketRepository.saveAndFlush(any(Ticket.class))).thenAnswer(invocation -> {
            Ticket t = invocation.getArgument(0);
            t.setId(UUID.randomUUID());
            createdTickets.add(t);
            return t;
        });
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(ticketSignatureService.generateSignature(any(), any())).thenReturn("sig123");
        when(ticketSignatureService.buildPayload(any(), any())).thenReturn("TKRUSH:v1:test");
        when(orderRepository.findById(order.getId())).thenReturn(java.util.Optional.of(order));
        when(ticketRepository.findByOrderId(order.getId())).thenReturn(createdTickets);

        assertDoesNotThrow(() ->
                checkoutService.createSession(request, user.getId().toString())
        );
    }
}
