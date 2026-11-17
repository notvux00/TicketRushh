package com.ticketrush.repository;

import com.ticketrush.model.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select o from Order o where o.id = :id")
    java.util.Optional<Order> findForCheckout(@org.springframework.data.repository.query.Param("id") UUID id);

    java.util.List<Order> findByUserIdOrderByCreatedAtDesc(UUID userId);
    java.util.List<Order> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, String status);
}
