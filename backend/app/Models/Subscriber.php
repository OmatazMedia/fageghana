<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscriber extends Model
{
    protected $table = 'subscribers';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['email', 'is_active', 'subscribed_at', 'unsubscribed_at'];


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
