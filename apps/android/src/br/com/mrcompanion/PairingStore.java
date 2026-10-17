package br.com.mrcompanion;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Encrypts the optional PC pairing code with a non-exportable Android Keystore key. */
final class PairingStore {
    private static final String ALIAS="arquest-pc-pairing-v1",PREFS="arquest-secure-settings-v1";
    static void save(Context context,String value)throws Exception{
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());byte[] encrypted=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString("iv",android.util.Base64.encodeToString(cipher.getIV(),android.util.Base64.NO_WRAP)).putString("code",android.util.Base64.encodeToString(encrypted,android.util.Base64.NO_WRAP)).apply();
    }
    static String load(Context context){
        try{SharedPreferences p=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);String iv=p.getString("iv",null),value=p.getString("code",null);if(iv==null||value==null)return null;Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,android.util.Base64.decode(iv,android.util.Base64.NO_WRAP)));return new String(cipher.doFinal(android.util.Base64.decode(value,android.util.Base64.NO_WRAP)),StandardCharsets.UTF_8);}catch(Exception e){clear(context);return null;}
    }
    static void clear(Context context){context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().clear().apply();}
    private static SecretKey key()throws Exception{KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);java.security.Key existing=store.getKey(ALIAS,null);if(existing instanceof SecretKey)return (SecretKey)existing;KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true).build());return generator.generateKey();}
}
