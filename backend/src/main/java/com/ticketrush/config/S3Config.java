package com.ticketrush.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
public class S3Config {

    @Value("${app.media.region:ap-southeast-1}")
    private String region;

    @Value("${app.media.endpoint:}")
    private String endpoint;

    @Value("${app.media.public-endpoint:}")
    private String publicEndpoint;

    @Value("${app.media.path-style:false}")
    private boolean pathStyle;

    @Bean
    public S3Client s3Client() {
        var builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create());

        if (StringUtils.hasText(endpoint)) {
            builder.endpointOverride(URI.create(endpoint));
            builder.forcePathStyle(pathStyle);
        }
        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        var builder = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create());

        String presignEndpoint = StringUtils.hasText(publicEndpoint) ? publicEndpoint : endpoint;
        if (StringUtils.hasText(presignEndpoint)) {
            builder.endpointOverride(URI.create(presignEndpoint));
            builder.serviceConfiguration(S3Configuration.builder()
                    .pathStyleAccessEnabled(pathStyle)
                    .build());
        }
        return builder.build();
    }
}
