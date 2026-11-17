package com.ticketrush.service;

import com.ticketrush.repository.TicketRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.ticketrush.util.PriceValidation;
import java.time.LocalDateTime;
import com.ticketrush.model.dto.EventResponse;
import com.ticketrush.repository.EventRepository;
import org.springframework.stereotype.Service;
import com.ticketrush.model.dto.EventCreateRequest;
import com.ticketrush.model.dto.EventUpdateRequest;
import com.ticketrush.model.entity.Event;
import com.ticketrush.model.entity.Showtime;
import com.ticketrush.model.entity.User;
import com.ticketrush.model.entity.Zone;
import com.ticketrush.repository.ShowtimeRepository;
import com.ticketrush.repository.UserRepository;
import com.ticketrush.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final TicketRepository ticketRepository;
    private final ObjectMapper objectMapper;
    private final ShowtimeRepository showtimeRepository;
    private final UserRepository userRepository;
    private final ZoneService zoneService;
    private final ZoneRepository zoneRepository;

    @Transactional(readOnly = true)
    public List<EventResponse> getAllEvents() {
        return eventRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public EventResponse getEventById(UUID id) {
        return eventRepository.findById(id)
                .map(this::mapToResponse)
                .orElseThrow(() -> new RuntimeException("Event not found"));
    }

    private EventResponse mapToResponse(Event event) {
        EventResponse dto = new EventResponse();
        dto.setId(event.getId());
        dto.setEventName(event.getEventName());
        dto.setDescription(event.getDescription());
        dto.setCategory(event.getCategory());
        dto.setCoverImage(event.getCoverImage());
        dto.setTrailerUrl(event.getTrailerUrl());
        dto.setVenueName(event.getVenueName());
        dto.setVenueAddress(event.getVenueAddress());
        dto.setMaxTicketsPerOrder(event.getMaxTicketsPerOrder());

        if (event.getShowtimes() != null) {
            dto.setShowtimes(event.getShowtimes().stream()
                    .map(this::mapShowtimeToResponse)
                    .collect(Collectors.toList()));
        }

        double minPrice = event.getShowtimes() == null ? 0.0 : event.getShowtimes().stream()
                .filter(st -> st.getZones() != null)
                .flatMap(st -> st.getZones().stream())
                .filter(zone -> zone.getPrice() != null)
                .mapToDouble(Zone::getPrice)
                .min()
                .orElse(0.0);
        dto.setMinPrice(minPrice);

        return dto;
    }

    private EventResponse.ShowtimeResponse mapShowtimeToResponse(Showtime showtime) {
        EventResponse.ShowtimeResponse dto = new EventResponse.ShowtimeResponse();
        dto.setId(showtime.getId());
        dto.setName(showtime.getName());
        dto.setStartTime(com.ticketrush.util.EventTime.toOffset(showtime.getStartTime()));
        dto.setEndTime(com.ticketrush.util.EventTime.toOffset(showtime.getEndTime()));
        return dto;
    }

    @Transactional
    public EventResponse createEvent(EventCreateRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new RuntimeException("Xác thực không hợp lệ!");
        }

        String adminId = auth.getName();

        User admin = userRepository.findById(UUID.fromString(adminId))
                .orElseThrow(() -> new RuntimeException("Tài khoản Admin không tồn tại!"));

        validateCap(request.getMaxTicketsPerOrder());
        if (request.getZones() != null) request.getZones().forEach(zone ->
                PriceValidation.requireValid(zone.getPrice()));
        Event event = new Event();
        event.setEventName(request.getEventName());
        event.setDescription(request.getDescription());
        event.setCategory(request.getCategory());
        event.setCoverImage(request.getCoverImage());
        event.setTrailerUrl(request.getTrailerUrl());
        event.setVenueName(request.getVenueName());
        event.setVenueAddress(request.getVenueAddress());
        event.setMaxTicketsPerOrder(request.getMaxTicketsPerOrder());
        event.setCreator(admin);

        Event savedEvent = eventRepository.save(event);

        List<Showtime> showtimesToSave = new ArrayList<>();
        if (request.getShowtimes() != null) {
            for (var stReq : request.getShowtimes()) {
                Showtime showtime = new Showtime();
                showtime.setName(stReq.getName());
                showtime.setStartTime(stReq.getStartTime());
                showtime.setEndTime(stReq.getEndTime());
                showtime.setEvent(savedEvent);
                showtimesToSave.add(showtime);
            }
        }
        List<Showtime> savedShowtimes = showtimeRepository.saveAllAndFlush(showtimesToSave);

        if (request.getZones() != null && !request.getZones().isEmpty()) {
            zoneService.createBulkZonesAndSeats(savedShowtimes, request.getZones());
        }

        EventResponse response = new EventResponse();
        response.setId(savedEvent.getId());
        response.setShowtimes(savedShowtimes.stream()
                .map(this::mapShowtimeToResponse)
                .collect(Collectors.toList()));

        return response;
    }

    @Transactional
    public EventResponse updateEvent(UUID eventId, EventUpdateRequest request) {
        return updateEventInternal(eventId, request, null);
    }

    @Transactional
    public EventResponse patchEvent(UUID eventId, JsonNode fields) {
        if (!fields.isObject()) throw new IllegalArgumentException("Expected an event object");
        try {
            return updateEventInternal(eventId, objectMapper.treeToValue(fields, EventUpdateRequest.class), fields);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid event update", e);
        }
    }

    private static boolean changes(JsonNode fields, String name) {
        return fields == null || fields.has(name);
    }

    private static void validateCap(Integer cap) {
        if (cap != null && cap < 1) throw new IllegalArgumentException("Ticket limit must be positive");
    }

    private EventResponse updateEventInternal(UUID eventId, EventUpdateRequest request,
            JsonNode fields) {
        validateCap(request.getMaxTicketsPerOrder());
        Event event = eventRepository.findForUpdate(eventId)
                .orElseThrow(() -> new RuntimeException("Sự kiện không tồn tại!"));

        eventRepository.updateEditableFields(
                eventId,
                changes(fields, "coverImage") ? request.getCoverImage() : event.getCoverImage(),
                changes(fields, "description") ? request.getDescription() : event.getDescription(),
                changes(fields, "venueName") ? request.getVenueName() : event.getVenueName(),
                changes(fields, "venueAddress") ? request.getVenueAddress() : event.getVenueAddress(),
                changes(fields, "maxTicketsPerOrder") ? request.getMaxTicketsPerOrder() : event.getMaxTicketsPerOrder());

        if (request.getShowtimes() != null) {
            int index = 0;
            for (EventUpdateRequest.ShowtimeUpdateRequest stReq : request.getShowtimes()) {
                var item = fields == null ? null : fields.path("showtimes").path(index++);
                if (stReq.getId() == null) {
                    throw new RuntimeException("Thiếu ID suất diễn cần cập nhật!");
                }
                Showtime showtime = showtimeRepository.findById(stReq.getId())
                        .orElseThrow(() -> new RuntimeException("Suất diễn không tồn tại!"));
                if (!showtime.getEvent().getId().equals(eventId)) {
                    throw new RuntimeException("Suất diễn không thuộc sự kiện này!");
                }
                if (changes(item, "name")) showtime.setName(stReq.getName());
                if (changes(item, "startTime")) showtime.setStartTime(stReq.getStartTime());
                if (changes(item, "endTime")) showtime.setEndTime(stReq.getEndTime());
                showtimeRepository.save(showtime);
            }
        }

        if (request.getZones() != null && request.getShowtimeIdForZones() != null) {
            Showtime zoneShowtime = showtimeRepository.findById(request.getShowtimeIdForZones())
                    .orElseThrow(() -> new RuntimeException("Suất diễn của phân khu không tồn tại!"));
            if (!zoneShowtime.getEvent().getId().equals(eventId)) {
                throw new RuntimeException("Suất diễn của phân khu không thuộc sự kiện này!");
            }

            int index = 0;
            for (EventUpdateRequest.ZoneUpdateRequest zoneReq : request.getZones()) {
                var item = fields == null ? null : fields.path("zones").path(index++);
                if (zoneReq.getId() == null) {
                    throw new RuntimeException("Thiếu ID phân khu cần cập nhật!");
                }
                Zone zone = zoneRepository.findById(zoneReq.getId())
                        .orElseThrow(() -> new RuntimeException("Phân khu không tồn tại!"));
                if (!zone.getShowtime().getId().equals(request.getShowtimeIdForZones())) {
                    throw new RuntimeException("Phân khu không thuộc suất diễn đang sửa!");
                }
                if (changes(item, "name")) zone.setName(zoneReq.getName());
                if (changes(item, "price")) zone.setPrice(PriceValidation.requireValid(zoneReq.getPrice()));
                zoneRepository.save(zone);
            }
        }

        return getEventById(eventId);
    }

    @Transactional
    public void deleteEvent(UUID id) {
        eventRepository.findForUpdate(id).orElseThrow(() -> new IllegalArgumentException("Event not found"));
        if (ticketRepository.protectedTicketsForEvent(id, LocalDateTime.now()) > 0) {
            throw new IllegalStateException("Cannot delete an event with issued tickets or an active checkout");
        }

        eventRepository.deleteTicketsByEventId(id);
        eventRepository.deleteSeatsByEventId(id);
        eventRepository.deleteZonesByEventId(id);
        eventRepository.deleteShowtimesByEventId(id);

        eventRepository.deleteEventById(id);
    }
}
