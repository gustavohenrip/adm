package com.opendownloader.odm.persistence;

import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

import org.springframework.stereotype.Component;

@Component
public final class PersistenceGate {
    private final ReentrantLock writeLock = new ReentrantLock(true);

    public <T> T write(Supplier<T> action) {
        writeLock.lock();
        try {
            return action.get();
        } finally {
            writeLock.unlock();
        }
    }

    public void write(Runnable action) {
        writeLock.lock();
        try {
            action.run();
        } finally {
            writeLock.unlock();
        }
    }
}
