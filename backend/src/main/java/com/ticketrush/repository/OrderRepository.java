package com.ticketrush.repository;

import com.ticketrush.model.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {
    java.util.List<Order> findByUserIdOrderByCreatedAtDesc(UUID userId);
    java.util.List<Order> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, String status);
}
