package com.ticketrush.service;

import com.ticketrush.model.dto.AuthResponse;
import com.ticketrush.model.dto.LoginRequest;
import com.ticketrush.model.dto.RegisterRequest;
import com.ticketrush.model.entity.User;
import com.ticketrush.repository.UserRepository;
import com.ticketrush.util.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        if (userRepository.findByEmail(normalizedEmail).isPresent()) {
            throw new RuntimeException("Email này đã được đăng ký tài khoản!");
        }

        // Tạo User mới với mật khẩu đã băm bằng BCrypt
        User user = User.builder()
                .id(UUID.randomUUID())
                .email(normalizedEmail)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .dateOfBirth(request.getDateOfBirth())
                .gender(request.getGender() != null ? request.getGender() : "Other")
                .phoneNumber(request.getPhoneNumber())
                .role("USER")
                .build();

        User savedUser = userRepository.save(user);
        String token = jwtTokenProvider.generateToken(savedUser);

        return toAuthResponse(savedUser, token);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new RuntimeException("Email hoặc mật khẩu không chính xác!"));

        // So khớp mật khẩu với chuỗi hash BCrypt
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Email hoặc mật khẩu không chính xác!");
        }

        String token = jwtTokenProvider.generateToken(user);
        return toAuthResponse(user, token);
    }

    @Transactional(readOnly = true)
    public AuthResponse.UserSummary getMe(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));
        return toUserSummary(user);
    }

    private AuthResponse toAuthResponse(User user, String token) {
        return AuthResponse.builder()
                .token(token)
                .user(toUserSummary(user))
                .build();
    }

    private AuthResponse.UserSummary toUserSummary(User user) {
        return AuthResponse.UserSummary.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole() != null ? user.getRole() : "USER")
                .avatarUrl(user.getAvatarUrl())
                .build();
    }
}
