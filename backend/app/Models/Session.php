<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Session extends Model
{
    protected $table = 'sessions';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['user_id', 'ip_address', 'user_agent', 'payload', 'last_activity'];

    public $timestamps = false;

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
