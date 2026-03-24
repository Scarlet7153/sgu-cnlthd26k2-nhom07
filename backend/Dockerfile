# ==========================================
# (Optional) Generic BE Dockerfile
# Stage 1: Build Spring Boot Application
# ==========================================
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Copy Maven POMs and resolve dependencies (allows Docker cache for deps)
COPY pom.xml ./
RUN mvn dependency:go-offline -B || echo "Skipped offline deps fetching"

# Copy full source and package
COPY src ./src
RUN mvn -B -DskipTests package

# ==========================================
# Stage 2: Serve Spring Boot Application
# ==========================================
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copy the built jar file
COPY --from=build /workspace/target/*.jar app.jar

EXPOSE 8080
# Run the Java application
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
