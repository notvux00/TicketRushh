package com.ticketrush.bootstrap;

import com.ticketrush.model.entity.User;
import com.ticketrush.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.UUID;

/**
 * Creates or promotes the demo admin account. Disabled by default; enable it
 * only for local/demo environments with APP_BOOTSTRAP_ADMIN=true.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AdminBootstrap implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.bootstrap.admin.enabled:false}")
    private boolean enabled;

    @Value("${app.bootstrap.admin.email:}")
    private String email;

    @Value("${app.bootstrap.admin.password:}")
    private String password;

    @Value("${app.bootstrap.admin.reset-password:false}")
    private boolean resetPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled || !StringUtils.hasText(email) || !StringUtils.hasText(password)) {
            return;
        }

        String normalizedEmail = email.trim().toLowerCase();
        User user = userRepository.findByEmail(normalizedEmail).orElseGet(() -> User.builder()
                .id(UUID.randomUUID())
                .email(normalizedEmail)
                .password(passwordEncoder.encode(password))
                .fullName("TicketRush Admin")
                .role("ADMIN")
                .build());

        boolean changed = false;
        if (!"ADMIN".equalsIgnoreCase(user.getRole())) {
            user.setRole("ADMIN");
            changed = true;
        }
        if (resetPassword || !StringUtils.hasText(user.getPassword())) {
            user.setPassword(passwordEncoder.encode(password));
            changed = true;
        }

        if (userRepository.findByEmail(normalizedEmail).isEmpty() || changed) {
            userRepository.save(user);
        }
        log.info("Admin bootstrap ensured for {}", normalizedEmail);
    }
}
