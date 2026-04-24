package com.opendownloader.odm.security;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.EnumSet;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

import jakarta.annotation.PostConstruct;

import org.springframework.stereotype.Component;

@Component
public class CredentialVault {

    private static final int SALT_LEN = 16;
    private static final int IV_LEN = 12;
    private static final int TAG_LEN_BITS = 128;
    private static final int KEY_ITER = 120_000;
    private static final int KEY_LEN_BITS = 256;

    private byte[] salt;
    private byte[] keyBytes;

    @PostConstruct
    public void init() throws Exception {
        Path dir = Paths.get(System.getProperty("user.home"), ".odm");
        if (!Files.exists(dir)) Files.createDirectories(dir);
        Path saltPath = dir.resolve("vault.salt");
        if (Files.exists(saltPath)) {
            salt = Files.readAllBytes(saltPath);
        } else {
            salt = new byte[SALT_LEN];
            new SecureRandom().nextBytes(salt);
            Files.write(saltPath, salt, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
            restrictPermissions(saltPath);
        }
        keyBytes = deriveKey(machineSecret(), salt);
    }

    public String encrypt(String plaintext) throws Exception {
        byte[] iv = new byte[IV_LEN];
        new SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new GCMParameterSpec(TAG_LEN_BITS, iv));
        byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        byte[] combined = new byte[iv.length + ct.length];
        System.arraycopy(iv, 0, combined, 0, iv.length);
        System.arraycopy(ct, 0, combined, iv.length, ct.length);
        return Base64.getEncoder().encodeToString(combined);
    }

    public String decrypt(String base64) throws Exception {
        byte[] combined = Base64.getDecoder().decode(base64);
        byte[] iv = new byte[IV_LEN];
        System.arraycopy(combined, 0, iv, 0, IV_LEN);
        byte[] ct = new byte[combined.length - IV_LEN];
        System.arraycopy(combined, IV_LEN, ct, 0, ct.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keyBytes, "AES"), new GCMParameterSpec(TAG_LEN_BITS, iv));
        byte[] pt = cipher.doFinal(ct);
        return new String(pt, StandardCharsets.UTF_8);
    }

    private static char[] machineSecret() {
        String user = System.getProperty("user.name", "odm");
        String home = System.getProperty("user.home", "/tmp");
        String os = System.getProperty("os.name", "");
        return (user + "|" + home + "|" + os + "|odm-vault-v1").toCharArray();
    }

    private static byte[] deriveKey(char[] password, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(password, salt, KEY_ITER, KEY_LEN_BITS);
        SecretKeyFactory f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        return f.generateSecret(spec).getEncoded();
    }

    private static void restrictPermissions(Path path) {
        try {
            Files.setPosixFilePermissions(path, PosixFilePermissions.fromString("rw-------"));
        } catch (UnsupportedOperationException | java.io.IOException ignored) {
        }
    }
}
