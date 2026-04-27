package com.opendownloader.odm.download.http;

public final class RangeNotSupportedException extends RuntimeException {
    public RangeNotSupportedException(String message) {
        super(message);
    }
}
