package com.ticketrush.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.redis.spring.RedisLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;

@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "30s")
public class SchedulingConfig {

    @Bean
    public LockProvider lockProvider(
            RedisConnectionFactory connectionFactory,
            @Value("${app.scheduler.environment:demo}") String environment) {
        return new RedisLockProvider(connectionFactory, environment);
    }
}
