package com.opendownloader.odm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class OdmApplication {

    public static void main(String[] args) throws Exception {
        java.nio.file.Files.createDirectories(
            java.nio.file.Paths.get(System.getProperty("user.home"), ".odm")
        );
        SpringApplication.run(OdmApplication.class, args);
    }
}
