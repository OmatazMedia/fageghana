<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentConfig extends Model
{
    protected $table = 'payment_configs';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['provider', 'public_key', 'secret_key', 'merchant_id', 'webhook_secret', 'is_active', 'test_mode'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
