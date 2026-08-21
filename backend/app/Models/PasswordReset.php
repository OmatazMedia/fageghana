<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PasswordReset extends Model
{
    protected $table = 'password_reset_tokens';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['email', 'token', 'created_at'];

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
