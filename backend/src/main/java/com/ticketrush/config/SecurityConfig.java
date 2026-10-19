package com.ticketrush.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import jakarta.servlet.http.HttpServletResponse;
import java.util.List;

/**
 * SecurityConfig — Cấu hình Spring Security cho TicketRush.
 *
 * Chiến lược:
 * - Stateless (không dùng Session/Cookie) vì dùng JWT từ Supabase.
 * - CSRF disabled (không cần vì Stateless + JWT).
 * - CORS cho phép React frontend (localhost:5173) truy cập.
 * - Một số route public (health check, status), còn lại cần JWT hợp lệ.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}")
    private String jwkSetUri;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // 1. Tắt CSRF (Stateless API không cần)
                .csrf(AbstractHttpConfigurer::disable)

                // 2. Cấu hình CORS
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // 3. Session policy: STATELESS — không tạo session phía server
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // 4. Phân quyền route
                .authorizeHttpRequests(auth -> auth
                        // Protected routes for booking
                        .requestMatchers("/api/events/seats/lock", "/api/events/seats/unlock",
                                "/api/events/seats/confirm")
                        .authenticated()

                        // Virtual Queue
                        .requestMatchers("/api/queue/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/queue/**").authenticated()

                        // Public routes — không cần đăng nhập
                        .requestMatchers("/ws/**", "/", "/api/status", "/api/events/**", "/api/events", "/actuator/**")
                        .permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // Chỉ ADMIN mới vào được các route /api/admin/**
                        // (Role được lấy từ JWT claim "app_metadata.role")
                        // .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // Mọi route còn lại đều yêu cầu JWT hợp lệ
                        .anyRequest().authenticated())

                // 5. Sử dụng OAuth2 Resource Server để tự động verify JWT
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, authException.getMessage());
                        }));

        return http.build();
    }

    /**
     * CORS Config — cho phép React frontend gọi vào Backend.
     * Khi deploy production, thay "http://localhost:5173" bằng domain thật.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(List.of(
                "http://localhost:5173", // Vite dev server
                "http://localhost:3000" // Dự phòng nếu đổi port
        ));

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * Converter để trích xuất role từ JWT của Supabase.
     * Supabase lưu role ở dạng: "app_metadata": { "role": "ADMIN" }
     */
    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            try {
                java.util.Map<String, Object> appMetadata = jwt.getClaimAsMap("app_metadata");
                if (appMetadata != null && appMetadata.containsKey("role")) {
                    String role = (String) appMetadata.get("role");
                    return List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
                }
            } catch (Exception e) {
                // Ignore if app_metadata is missing or malformed
            }
            return List.of();
        });
        return converter;
    }

    /**
     * Tùy chỉnh JwtDecoder để Spring Security sử dụng thuật toán ES256
     * (Mặc định Spring Security dùng RS256, nên sẽ bị lỗi khi Supabase dùng ES256)
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
                .jwsAlgorithm(SignatureAlgorithm.ES256)
                .build();
    }
}
