package com.ticketrush.util;

public final class PriceValidation {
    private PriceValidation() {}

    public static double requireValid(Double price) {
        if (price == null || !Double.isFinite(price) || price < 0) {
            throw new IllegalArgumentException("Price must be a finite non-negative amount");
        }
        return price;
    }
}
