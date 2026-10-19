package com.ticketrush.repository;

import com.ticketrush.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    
    // Tìm kiếm User theo Email (hữu ích cho việc kiểm tra trùng lặp hoặc đăng nhập)
    Optional<User> findByEmail(String email);
}
