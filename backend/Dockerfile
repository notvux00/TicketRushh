# syntax=docker/dockerfile:1

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace

COPY pom.xml ./
RUN mvn -B -q -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:17-jre-jammy
RUN groupadd --system ticketrush && useradd --system --gid ticketrush --home-dir /app ticketrush

WORKDIR /app
COPY --from=build /workspace/target/api-*.jar /app/app.jar
RUN chown -R ticketrush:ticketrush /app

USER ticketrush
EXPOSE 8080

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
