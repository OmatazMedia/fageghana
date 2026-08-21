<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Countdown extends Model
{
    protected $table = 'countdowns';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['title', 'target_date', 'description', 'is_active'];


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
