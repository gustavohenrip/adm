plugins {
    java
    id("org.springframework.boot") version "3.3.5"
    id("io.spring.dependency-management") version "1.1.6"
}

group = "com.azrael"
version = "0.1.0-SNAPSHOT"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-quartz")
    implementation("org.xerial:sqlite-jdbc:3.46.1.3")
    implementation("org.hibernate.orm:hibernate-community-dialects:6.5.3.Final")
    implementation("org.frostwire:jlibtorrent:1.2.19.0")
    implementation("org.frostwire:jlibtorrent-macos:1.2.19.0")
    implementation("org.frostwire:jlibtorrent-linux:1.2.19.0")
    implementation("org.frostwire:jlibtorrent-windows:1.2.19.0")
    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
}

tasks.test {
    useJUnitPlatform()
}

springBoot {
    mainClass.set("com.azrael.adm.AdmApplication")
}
