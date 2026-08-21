<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    protected $table = 'events';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['title', 'slug', 'description', 'image', 'location', 'start_date', 'end_date', 'time', 'status', 'capacity', 'registration_url', 'tags'];


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
