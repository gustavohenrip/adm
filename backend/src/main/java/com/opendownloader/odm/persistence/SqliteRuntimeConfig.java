package com.opendownloader.odm.persistence;

import java.sql.Connection;
import java.sql.Statement;

import javax.sql.DataSource;

import jakarta.annotation.PostConstruct;

import org.springframework.stereotype.Component;

@Component
public final class SqliteRuntimeConfig {
    private final DataSource dataSource;

    public SqliteRuntimeConfig(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @PostConstruct
    public void configure() throws Exception {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA journal_mode=WAL");
            statement.execute("PRAGMA busy_timeout=10000");
            statement.execute("PRAGMA synchronous=NORMAL");
        }
    }
}
