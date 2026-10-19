package com.ticketrush.repository;

import com.ticketrush.model.entity.Showtime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;
import java.util.List;

@Repository
public interface ShowtimeRepository extends JpaRepository<Showtime, UUID> {
    // JpaRepository sẽ tự động cung cấp hàm .save() để lưu suất diễn
    List<Showtime> findByEventId(UUID eventId);
}