package com.ticketrush.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import jakarta.servlet.http.HttpServletResponse;
import java.util.List;

/**
 * SecurityConfig — Cấu hình Spring Security nội bộ cho TicketRush.
 *
 * Chiến lược:
 * - Stateless (không dùng Session/Cookie), xác thực qua JWT tự cấp phát.
 * - CSRF disabled (API Stateless).
 * - Mật khẩu mã hóa BCrypt.
 * - CORS cho phép React frontend kết nối.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // 1. Tắt CSRF (Stateless API)
                .csrf(AbstractHttpConfigurer::disable)

                // 2. Cấu hình CORS
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // 3. Session policy: STATELESS
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // 4. Phân quyền route
                .authorizeHttpRequests(auth -> auth
                        // Public auth routes (Đăng ký, Đăng nhập)
                        .requestMatchers("/api/auth/**").permitAll()

                        // Public routes khác (Xem sự kiện, trạng thái server, websocket)
                        .requestMatchers("/", "/api/status", "/api/events/**", "/api/events", "/ws/**", "/actuator/**")
                        .permitAll()

                        // Protected routes for booking
                        .requestMatchers("/api/events/seats/lock", "/api/events/seats/unlock",
                                "/api/events/seats/confirm")
                        .authenticated()

                        // Admin routes
                        .requestMatchers("/api/admin/**", "/api/queue/admin/**").hasRole("ADMIN")

                        // Mọi route còn lại (profile, orders, queue) đều yêu cầu đã đăng nhập
                        .anyRequest().authenticated())

                // 5. Xử lý lỗi xác thực 401 Unauthorized
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized: " + authException.getMessage());
                        }))

                // 6. Thêm JWT Filter kiểm tra token trước UsernamePasswordAuthenticationFilter
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * CORS Config — cho phép React frontend gọi vào Backend.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(List.of(
                "http://localhost:5173", // Vite dev server
                "http://localhost:3000"  // Dự phòng
        ));

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
