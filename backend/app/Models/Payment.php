<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $table = 'payments';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['user_id', 'member_id', 'amount', 'currency', 'provider', 'reference', 'status', 'description', 'metadata', 'paid_at', 'verified_at', 'subscription_tier', 'payment_type'];


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
